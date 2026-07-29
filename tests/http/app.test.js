const test = require("node:test");
const assert = require("node:assert");

const { stubConfig } = require("../helpers/stub");
const fakeModels = require("../helpers/fakeModels");
const { start } = require("../helpers/httpClient");

// developmentMode bypasses LDAP, so the suite can sign in without a directory
// server. Group access checks are covered separately in tests/unit/middleware.
stubConfig({ developmentMode: true });
const { db, faults } = fakeModels.install();
const XSS = `"><script>alert(1)</script>`;
fakeModels.seed(db, { xss: XSS });

const app = require("../../app");

let client;
test.before(async () => {
  client = await start(app);
});
test.after(async () => {
  await client.close();
});

async function signIn(username = "alice") {
  const res = await client.postForm("/signin", { username, password: "x" });
  assert.strictEqual(res.status, 302, "sign in did not redirect");
  return res;
}

test("unauthenticated access", async (t) => {
  await t.test("redirects the home page to /signin", async () => {
    const res = await client.get("/");
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.get("location"), "/signin");
  });

  await t.test("redirects a deep browse URL to /signin", async () => {
    const res = await client.get("/browse/alpha/proj/samp");
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.get("location"), "/signin");
  });

  await t.test("serves the sign-in page itself", async () => {
    const res = await client.get("/signin");
    assert.strictEqual(res.status, 200);
    assert.match(res.body, /name="username"/);
  });
});

test("response hardening", async (t) => {
  await t.test("does not advertise Express", async () => {
    const res = await client.get("/signin");
    assert.strictEqual(res.headers.get("x-powered-by"), null);
  });

  await t.test("session cookie is httpOnly and SameSite", async () => {
    const res = await client.get("/signin");
    const cookies = res.headers.getSetCookie().join(";");
    if (cookies.includes("connect.sid")) {
      assert.match(cookies, /HttpOnly/i);
      assert.match(cookies, /SameSite=Lax/i);
    }
  });
});

test("signed in", async (t) => {
  await t.test("signing in redirects and then the home page renders", async () => {
    await signIn();
    const res = await client.get("/");
    assert.strictEqual(res.status, 200);
    assert.match(res.body, /Alpha Group/);
  });

  await t.test("returns the user to the page they asked for", async () => {
    const fresh = await start(app);
    try {
      await fresh.get("/browse/alpha/proj");
      const res = await fresh.postForm("/signin", {
        username: "alice",
        password: "x",
      });
      assert.strictEqual(res.headers.get("location"), "/browse/alpha/proj");
    } finally {
      await fresh.close();
    }
  });

  await t.test("renders the help page", async () => {
    const res = await client.get("/help");
    assert.strictEqual(res.status, 200);
  });

  await t.test("renders a group, project, sample, experiment and capture", async () => {
    for (const url of [
      "/browse/alpha",
      "/browse/alpha/proj",
      "/browse/alpha/proj/samp",
      "/browse/alpha/proj/samp/exp",
      "/browse/alpha/proj/samp/exp/cap",
      "/browse/alpha/proj/samp/exp/cap/abc123",
    ]) {
      const res = await client.get(url);
      assert.strictEqual(res.status, 200, `${url} returned ${res.status}`);
    }
  });

  await t.test("renders the 'new' form at every level", async () => {
    for (const url of [
      "/browse/alpha/new",
      "/browse/alpha/proj/new",
      "/browse/alpha/proj/samp/new",
      "/browse/alpha/proj/samp/exp/new",
    ]) {
      const res = await client.get(url);
      assert.strictEqual(res.status, 200, `${url} returned ${res.status}`);
    }
  });

  await t.test("renders the edit form at every level", async () => {
    for (const url of [
      "/browse/alpha/proj/edit",
      "/browse/alpha/proj/samp/edit",
      "/browse/alpha/proj/samp/exp/edit",
      "/browse/alpha/proj/samp/exp/cap/edit",
    ]) {
      const res = await client.get(url);
      assert.strictEqual(res.status, 200, `${url} returned ${res.status}`);
    }
  });
});

test("stored XSS does not reach the browser", async (t) => {
  await t.test("group and project names are escaped", async () => {
    await signIn();
    for (const url of [
      "/",
      "/browse/alpha",
      "/browse/alpha/proj",
      "/browse/alpha/proj/samp",
      "/browse/alpha/proj/samp/exp",
      "/browse/alpha/proj/samp/exp/cap",
      "/browse/alpha/proj/samp/exp/cap/abc123",
    ]) {
      const res = await client.get(url);
      assert.ok(
        !res.body.includes("<script>alert(1)</script>"),
        `${url} echoed an injected script tag`,
      );
    }
  });
});

test("missing records return 404 rather than hanging or crashing", async (t) => {
  // Every one of these used to leave the request open forever and terminate the
  // process with an unhandled rejection, because the model find() rejects and
  // nothing caught it.
  const missing = [
    "/browse/alpha/nosuch",
    "/browse/alpha/nosuch/new",
    "/browse/alpha/proj/nosuch",
    "/browse/alpha/proj/nosuch/new",
    "/browse/alpha/proj/samp/nosuch",
    "/browse/alpha/proj/samp/nosuch/new",
    "/browse/alpha/proj/samp/exp/nosuch",
    "/browse/alpha/proj/samp/exp/nosuch/edit",
    "/browse/alpha/proj/samp/exp/cap/nosuchfile",
    "/browse/alpha/proj/nosuch/edit",
    "/nonexistent-page",
  ];

  for (const url of missing) {
    await t.test(url, async () => {
      await signIn();
      const res = await client.get(url);
      assert.strictEqual(res.status, 404, `${url} returned ${res.status}`);
    });
  }
});

test("the process survives a database failure", async (t) => {
  await t.test("home page reports an error instead of crashing", async () => {
    await signIn();
    faults.failNext = new Error("rethinkdb is down");

    const res = await client.get("/");
    assert.ok(
      res.status >= 500,
      `expected a server error, got ${res.status}`,
    );

    // The important part: the server is still answering requests.
    const after = await client.get("/signin");
    assert.strictEqual(after.status, 200, "server stopped serving after a DB error");
  });

  await t.test("the failure is reported on the error page", async () => {
    await signIn();
    faults.failNext = new Error("rethinkdb is down");
    const res = await client.get("/");
    assert.match(res.body, /rethinkdb is down/);
    // This config is developmentMode, where the stack is shown on purpose.
    // tests/unit/renderError.test.js covers the production behaviour.
  });
});

test("sign out", async (t) => {
  await t.test("clears the session", async () => {
    await signIn();
    assert.strictEqual((await client.get("/")).status, 200);

    const res = await client.get("/signout");
    assert.strictEqual(res.status, 302);

    const after = await client.get("/");
    assert.strictEqual(after.status, 302);
    assert.strictEqual(after.headers.get("location"), "/signin");
  });
});
