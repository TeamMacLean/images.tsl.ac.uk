const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const { stubConfig, stubModule } = require("../helpers/stub");

const posts = [];
let nextPostFails = false;
stubModule("axios", {
  post(url, body) {
    posts.push({ url, body });
    return nextPostFails
      ? Promise.reject(new Error("downstream is down"))
      : Promise.resolve({ status: 200 });
  },
});

const config = stubConfig();
const postUpload = require("../../lib/postUpload");

function fakeFile(pathValue = "/images/alpha/proj/abc123") {
  return { getPath: () => Promise.resolve(pathValue) };
}

const settle = () => new Promise((r) => setImmediate(r));

test("postUpload.notify", async (t) => {
  t.beforeEach(() => {
    posts.length = 0;
    nextPostFails = false;
    delete config.postChangesTo;
  });

  await t.test("does nothing when no hook URL is configured", async () => {
    postUpload.notify(fakeFile());
    await settle();
    assert.strictEqual(posts.length, 0);
  });

  await t.test("does nothing when the hook URL is empty", async () => {
    config.postChangesTo = "";
    postUpload.notify(fakeFile());
    await settle();
    assert.strictEqual(posts.length, 0);
  });

  await t.test("posts the file path when a hook URL is configured", async () => {
    config.postChangesTo = "https://hook.example/notify";
    postUpload.notify(fakeFile("/images/alpha/proj/abc123"));
    await settle();
    await settle();

    assert.strictEqual(posts.length, 1);
    assert.strictEqual(posts[0].url, "https://hook.example/notify");
    assert.deepStrictEqual(posts[0].body, {
      params: "/images/alpha/proj/abc123",
    });
  });

  await t.test("a failing hook does not throw at the caller", async () => {
    // This runs inside File's pre-save hook: a rejection escaping here would
    // fail the save, or terminate the process as an unhandled rejection.
    config.postChangesTo = "https://hook.example/notify";
    nextPostFails = true;

    assert.doesNotThrow(() => postUpload.notify(fakeFile()));
    await settle();
    await settle();
  });

  await t.test("a file whose path cannot be resolved does not throw", async () => {
    config.postChangesTo = "https://hook.example/notify";
    const broken = { getPath: () => Promise.reject(new Error("no capture")) };

    assert.doesNotThrow(() => postUpload.notify(broken));
    await settle();
    await settle();
    assert.strictEqual(posts.length, 0);
  });
});
