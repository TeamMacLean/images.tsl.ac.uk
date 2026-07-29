const test = require("node:test");
const assert = require("node:assert");

const { stubConfig } = require("../helpers/stub");

// Production settings: stack traces must not reach the browser.
stubConfig({ developmentMode: false });
const renderError = require("../../lib/renderError");

function fakeRes() {
  const calls = { status: null, view: null, locals: null };
  return {
    calls,
    status(code) {
      calls.status = code;
      return this;
    },
    render(view, locals) {
      calls.view = view;
      calls.locals = locals;
      return "rendered";
    },
  };
}

test("renderError", async (t) => {
  await t.test("renders the error view with a 500", () => {
    const res = fakeRes();
    renderError(res, new Error("boom"));

    assert.strictEqual(res.calls.view, "error");
    assert.strictEqual(res.calls.status, 500);
  });

  await t.test("withholds the stack outside development", () => {
    const res = fakeRes();
    renderError(res, new Error("boom"));
    assert.strictEqual(res.calls.locals.showStack, false);
  });

  await t.test("passes the error through for display", () => {
    const res = fakeRes();
    const err = new Error("boom");
    renderError(res, err);
    assert.strictEqual(res.calls.locals.error, err);
  });

  await t.test("does not throw when called without a response", () => {
    // It was called as renderError(err) in controllers/groups.js, which threw
    // inside a .catch() and took the process down as an unhandled rejection.
    assert.doesNotThrow(() => renderError(new Error("boom")));
    assert.doesNotThrow(() => renderError(undefined, new Error("boom")));
    assert.doesNotThrow(() => renderError({}, new Error("boom")));
  });
});
