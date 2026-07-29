const test = require("node:test");
const assert = require("node:assert");

const { stubConfig } = require("../helpers/stub");
const fakeModels = require("../helpers/fakeModels");

// developmentMode off, so the real access rules run rather than being waved
// through. This is the configuration production actually uses.
stubConfig({ developmentMode: false });
fakeModels.install();

const { isAuthenticated, isInGroup } = require("../../routes");

function fakeRes() {
  const calls = { status: null, view: null, locals: null, redirect: null };
  return {
    calls,
    status(code) {
      calls.status = code;
      return this;
    },
    render(view, locals) {
      calls.view = view;
      calls.locals = locals;
    },
    redirect(to) {
      calls.redirect = to;
    },
  };
}

test("isAuthenticated", async (t) => {
  await t.test("passes an authenticated request through", () => {
    let called = false;
    const req = { isAuthenticated: () => true, session: {}, path: "/x" };
    isAuthenticated(req, fakeRes(), () => {
      called = true;
    });
    assert.strictEqual(called, true);
  });

  await t.test("redirects an anonymous request to /signin", () => {
    const req = { isAuthenticated: () => false, session: {}, path: "/browse/alpha" };
    const res = fakeRes();
    isAuthenticated(req, res, () => assert.fail("should not have continued"));
    assert.strictEqual(res.calls.redirect, "/signin");
  });

  await t.test("remembers where the user was heading", () => {
    const req = { isAuthenticated: () => false, session: {}, path: "/browse/alpha/proj" };
    isAuthenticated(req, fakeRes(), () => {});
    assert.strictEqual(req.session.returnTo, "/browse/alpha/proj");
  });
});

test("isInGroup", async (t) => {
  const memberReq = (group) => ({
    params: { group },
    user: {
      username: "alice",
      memberOf: ["CN=alpha_modify,OU=groups,DC=example,DC=org"],
    },
  });

  await t.test("allows a member into their group", () => {
    let called = false;
    isInGroup(memberReq("alpha"), fakeRes(), () => {
      called = true;
    });
    assert.strictEqual(called, true);
  });

  await t.test("answers 403 for a group the user cannot access", () => {
    // This used to call next("you do not have permission..."). Express treats a
    // non-empty argument to next() as an error, so denial surfaced as a 500.
    const res = fakeRes();
    isInGroup(memberReq("beta"), res, (err) =>
      assert.fail(`should not have called next(${err})`),
    );
    assert.strictEqual(res.calls.status, 403);
    assert.strictEqual(res.calls.view, "error");
  });

  await t.test("answers 403 for a group that does not exist", () => {
    const res = fakeRes();
    isInGroup(memberReq("nosuchgroup"), res, () => assert.fail("continued"));
    assert.strictEqual(res.calls.status, 403);
  });

  await t.test("does not leak the group list in the denial message", () => {
    const res = fakeRes();
    isInGroup(memberReq("beta"), res, () => {});
    assert.ok(!String(res.calls.locals.error).includes("CN="));
  });
});
