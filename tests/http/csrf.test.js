const test = require("node:test");
const assert = require("node:assert");

const { stubConfig } = require("../helpers/stub");
const fakeModels = require("../helpers/fakeModels");
const { start } = require("../helpers/httpClient");

stubConfig({ developmentMode: true });
const { db } = fakeModels.install();
fakeModels.seed(db);

const app = require("../../app");

let client;
test.before(async () => {
  client = await start(app);
  await client.postForm("/signin", { username: "alice", password: "x" });
});
test.after(async () => {
  await client.close();
});

const NEW_PROJECT = {
  name: "Token Test",
  shortDescription: "s",
  longDescription: "l",
};

test("state-changing requests require a token", async (t) => {
  await t.test("a POST with no token is refused", async () => {
    const res = await client.postFormRaw("/browse/alpha/new", NEW_PROJECT);
    assert.strictEqual(res.status, 403);
  });

  await t.test("a POST with a wrong token is refused", async () => {
    const res = await client.postFormRaw("/browse/alpha/new", {
      ...NEW_PROJECT,
      _csrf: "not-the-right-token",
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test("a token of the right length but wrong value is refused", async () => {
    const real = await client.csrfToken();
    const forged = "a".repeat(real.length);
    const res = await client.postFormRaw("/browse/alpha/new", {
      ...NEW_PROJECT,
      _csrf: forged,
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test("a refused POST creates nothing", async () => {
    const before = db.projects.length;
    await client.postFormRaw("/browse/alpha/new", NEW_PROJECT);
    assert.strictEqual(db.projects.length, before);
  });

  await t.test("a POST with the session's token succeeds", async () => {
    const res = await client.postForm("/browse/alpha/new", NEW_PROJECT);
    assert.strictEqual(res.status, 302);
  });

  await t.test("the token is also accepted in a header", async () => {
    const token = await client.csrfToken();
    const res = await client.request("/browse/alpha/new", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": token,
      },
      body: new URLSearchParams({ ...NEW_PROJECT, name: "Header Token" }).toString(),
    });
    assert.strictEqual(res.status, 302);
  });
});

test("signing in is itself protected", async (t) => {
  await t.test("POST /signin without a token is refused", async () => {
    const fresh = await start(app);
    try {
      const res = await fresh.postFormRaw("/signin", {
        username: "mallory",
        password: "x",
      });
      assert.strictEqual(res.status, 403);
    } finally {
      await fresh.close();
    }
  });

  await t.test("POST /signin with a token succeeds", async () => {
    const fresh = await start(app);
    try {
      const res = await fresh.postForm("/signin", {
        username: "alice",
        password: "x",
      });
      assert.strictEqual(res.status, 302);
    } finally {
      await fresh.close();
    }
  });
});

test("reads are unaffected", async (t) => {
  const pages = [
    "/",
    "/help",
    "/signin",
    "/browse/alpha",
    "/browse/alpha/proj",
    "/browse/alpha/proj/samp",
  ];
  for (const url of pages) {
    await t.test(`GET ${url}`, async () => {
      const res = await client.get(url);
      assert.ok(res.status < 400, `${url} returned ${res.status}`);
    });
  }
});

test("every form carries a usable token", async (t) => {
  const formPages = [
    "/signin",
    "/browse/alpha/new",
    "/browse/alpha/proj/edit",
    "/browse/alpha/proj/new",
    "/browse/alpha/proj/samp/edit",
    "/browse/alpha/proj/samp/new",
    "/browse/alpha/proj/samp/exp/edit",
    "/browse/alpha/proj/samp/exp/new",
    "/browse/alpha/proj/samp/exp/cap/edit",
  ];

  for (const url of formPages) {
    await t.test(url, async () => {
      const res = await client.get(url);
      assert.strictEqual(res.status, 200, `${url} returned ${res.status}`);

      const forms = res.body.match(/<form\b[\s\S]*?<\/form>/g) || [];
      assert.ok(forms.length > 0, `${url} rendered no form`);

      for (const form of forms) {
        const match = form.match(/name="_csrf"\s+value="([^"]*)"/);
        assert.ok(match, `a form on ${url} has no _csrf field`);
        assert.ok(
          match[1] && match[1].length >= 32,
          `a form on ${url} rendered an empty token`,
        );
      }
    });
  }
});

test("the token is per session", async (t) => {
  await t.test("another session's token is not accepted", async () => {
    const other = await start(app);
    try {
      const otherToken = await other.csrfToken();
      const res = await client.postFormRaw("/browse/alpha/new", {
        ...NEW_PROJECT,
        _csrf: otherToken,
      });
      assert.strictEqual(res.status, 403);
    } finally {
      await other.close();
    }
  });
});
