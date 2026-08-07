const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const { stubConfig, stubModule, ROOT } = require("../helpers/stub");
const fakeModels = require("../helpers/fakeModels");
const { start } = require("../helpers/httpClient");

const WEBHOOK = "https://hooks.example.invalid/services/T000/B000/secret-token";

const posts = [];
let nextPostFails = false;
stubModule("axios", {
  post(url, body, opts) {
    posts.push({ url, body, opts });
    return nextPostFails
      ? Promise.reject(new Error("webhook unreachable"))
      : Promise.resolve({ status: 200, data: "ok" });
  },
});

stubConfig({ developmentMode: true, supportWebhook: WEBHOOK });
const { db } = fakeModels.install();
fakeModels.seed(db);

const app = require("../../app");
const Support = require("../../controllers/support");

let client;
test.before(async () => {
  client = await start(app);
});
test.after(async () => {
  await client.close();
});

// URLSearchParams encodes spaces as "+", which decodeURIComponent leaves alone.
function decodeBody(body) {
  return decodeURIComponent(String(body).replace(/\+/g, " "));
}

// The widget posts `payload=<json>` form-encoded with no CSRF token.
function widgetPost(client, text) {
  return client.request("/support/feedback", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "payload=" + JSON.stringify({ text }),
  });
}

test("the webhook never reaches the browser", async (t) => {
  await t.test("no page contains the webhook URL", async () => {
    // It used to be written straight into views/foot.ejs.
    const anon = await start(app);
    try {
      for (const url of ["/signin", "/help", "/"]) {
        const res = await anon.get(url);
        assert.ok(
          !res.body.includes(WEBHOOK),
          `${url} leaked the webhook URL`,
        );
        assert.ok(
          !res.body.includes("hooks.example.invalid"),
          `${url} leaked the webhook host`,
        );
      }
    } finally {
      await anon.close();
    }
  });

  await t.test("the widget is pointed at our own endpoint", async () => {
    const res = await client.get("/signin");
    assert.match(res.body, /SupportFab\.init/);
    assert.match(res.body, /url: '\/support\/feedback'/);
  });
});

test("relaying feedback", async (t) => {
  t.beforeEach(() => {
    posts.length = 0;
    nextPostFails = false;
    // Every test here comes from 127.0.0.1, so they would share one budget.
    Support._resetRateLimit();
  });

  await t.test("accepts the widget's form-encoded payload", async () => {
    const fresh = await start(app);
    try {
      const res = await widgetPost(fresh, "the upload button is broken");
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(JSON.parse(res.body), { ok: true });
      assert.strictEqual(posts.length, 1);
      assert.strictEqual(posts[0].url, WEBHOOK);
      assert.match(decodeBody(posts[0].body), /the upload button is broken/);
    } finally {
      await fresh.close();
    }
  });

  await t.test("works without a CSRF token", async () => {
    // The third-party bundle cannot send one; lib/csrf.js exempts this path.
    const fresh = await start(app);
    try {
      const res = await widgetPost(fresh, "no token here");
      assert.notStrictEqual(res.status, 403);
      assert.strictEqual(res.status, 200);
    } finally {
      await fresh.close();
    }
  });

  await t.test("attributes the message to the signed-in user", async () => {
    const fresh = await start(app);
    try {
      await fresh.postForm("/signin", { username: "alice", password: "x" });
      await widgetPost(fresh, "hello");
      assert.match(decodeBody(posts[0].body), /from alice/);
    } finally {
      await fresh.close();
    }
  });

  await t.test("says so when nobody is signed in", async () => {
    const fresh = await start(app);
    try {
      await widgetPost(fresh, "cannot log in!");
      assert.match(decodeBody(posts[0].body), /signed-out visitor/);
    } finally {
      await fresh.close();
    }
  });

  await t.test("rejects an empty or malformed payload", async () => {
    const fresh = await start(app);
    try {
      const empty = await fresh.request("/support/feedback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "",
      });
      assert.strictEqual(empty.status, 400);

      const junk = await fresh.request("/support/feedback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "payload=not-json",
      });
      assert.strictEqual(junk.status, 400);
      assert.strictEqual(posts.length, 0);
    } finally {
      await fresh.close();
    }
  });

  await t.test("rejects an oversized message", async () => {
    const fresh = await start(app);
    try {
      const res = await widgetPost(fresh, "x".repeat(5000));
      assert.strictEqual(res.status, 413);
      assert.strictEqual(posts.length, 0);
    } finally {
      await fresh.close();
    }
  });

  await t.test("reports a failing webhook without crashing", async () => {
    const fresh = await start(app);
    try {
      nextPostFails = true;
      const res = await widgetPost(fresh, "will not deliver");
      assert.strictEqual(res.status, 502);

      const after = await fresh.get("/signin");
      assert.strictEqual(after.status, 200, "server died on a webhook failure");
    } finally {
      await fresh.close();
    }
  });

  await t.test("rate limits a flood", async () => {
    const fresh = await start(app);
    try {
      const limit = Support._limits.MAX_PER_WINDOW;
      const attempts = limit + 4;
      const statuses = [];
      for (let i = 0; i < attempts; i++) {
        const res = await widgetPost(fresh, `spam ${i}`);
        statuses.push(res.status);
      }
      assert.ok(
        statuses.includes(429),
        `expected a 429 within ${attempts} attempts, got ${statuses.join(",")}`,
      );
      assert.strictEqual(
        posts.length,
        limit,
        `relayed ${posts.length} messages, limit is ${limit}`,
      );
    } finally {
      await fresh.close();
    }
  });
});
