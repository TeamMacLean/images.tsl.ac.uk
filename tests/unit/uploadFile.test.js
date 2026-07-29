const test = require("node:test");
const assert = require("node:assert");

const { stubConfig, stubModule, ROOT } = require("../helpers/stub");
const path = require("node:path");

stubConfig();

// uploadFile requires models/file, which would otherwise open a database
// connection just to parse a header.
const saved = [];
stubModule(
  path.join(ROOT, "models", "file.js"),
  class FakeFile {
    constructor(fields) {
      Object.assign(this, fields);
    }
    save() {
      saved.push(this);
      return Promise.resolve(this);
    }
  },
);

const uploadFile = require("../../lib/uploadFile");

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

test("_parseMetadataString", async (t) => {
  await t.test("decodes a well-formed tus metadata header", () => {
    const parsed = uploadFile._parseMetadataString(
      `filename ${b64("leaf.tif")},filetype ${b64("image/tiff")}`,
    );
    assert.strictEqual(parsed.filename.decoded, "leaf.tif");
    assert.strictEqual(parsed.filetype.decoded, "image/tiff");
  });

  await t.test("keeps the raw encoded value alongside the decoded one", () => {
    const parsed = uploadFile._parseMetadataString(`filename ${b64("a.tif")}`);
    assert.strictEqual(parsed.filename.encoded, b64("a.tif"));
  });

  await t.test("round-trips non-ASCII filenames", () => {
    // Decoding as 'ascii' mangled every accented or non-Latin filename.
    const name = "Blätter—Pflanze-日本.tif";
    const parsed = uploadFile._parseMetadataString(`filename ${b64(name)}`);
    assert.strictEqual(parsed.filename.decoded, name);
  });

  await t.test("returns an empty object for absent or empty input", () => {
    assert.deepStrictEqual(uploadFile._parseMetadataString(undefined), {});
    assert.deepStrictEqual(uploadFile._parseMetadataString(null), {});
    assert.deepStrictEqual(uploadFile._parseMetadataString(""), {});
  });

  await t.test("does not throw on malformed input", () => {
    // This runs inside a tus event handler with nothing to catch a throw.
    assert.doesNotThrow(() => uploadFile._parseMetadataString("garbage"));
    assert.doesNotThrow(() => uploadFile._parseMetadataString(",,,"));
    assert.doesNotThrow(() => uploadFile._parseMetadataString("key"));
    assert.doesNotThrow(() => uploadFile._parseMetadataString("a b c d"));
  });

  await t.test("treats a valueless key as empty, per the tus spec", () => {
    const parsed = uploadFile._parseMetadataString("iscomplete");
    assert.strictEqual(parsed.iscomplete.decoded, "");
  });

  await t.test("tolerates whitespace around pairs", () => {
    const parsed = uploadFile._parseMetadataString(
      `filename ${b64("a.tif")}, filetype ${b64("image/tiff")}`,
    );
    assert.strictEqual(parsed.filetype.decoded, "image/tiff");
  });
});

test("create", async (t) => {
  t.beforeEach(() => {
    saved.length = 0;
  });

  const completeEvent = () => ({
    file: {
      id: "abc123",
      upload_metadata: [
        `filename ${b64("leaf.tif")}`,
        `filetype ${b64("image/tiff")}`,
        `captureID ${b64("cap-1")}`,
        `description ${b64("day 3")}`,
      ].join(","),
    },
  });

  await t.test("saves a File for a complete upload", async () => {
    uploadFile.create(completeEvent());
    await new Promise((r) => setImmediate(r));

    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].name, "abc123");
    assert.strictEqual(saved[0].originalName, "leaf.tif");
    assert.strictEqual(saved[0].type, "image/tiff");
    assert.strictEqual(saved[0].captureID, "cap-1");
    assert.strictEqual(saved[0].description, "day 3");
  });

  await t.test("saves with a null description when none was sent", async () => {
    const event = completeEvent();
    event.file.upload_metadata = event.file.upload_metadata
      .split(",")
      .filter((p) => !p.startsWith("description"))
      .join(",");

    uploadFile.create(event);
    await new Promise((r) => setImmediate(r));

    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].description, null);
  });

  // Each of these used to throw out of a tus event handler and take the
  // whole server process down with it.
  const hostileEvents = {
    "no event": undefined,
    "no file": {},
    "null file": { file: null },
    "missing metadata": { file: { id: "x" } },
    "empty metadata": { file: { id: "x", upload_metadata: "" } },
    "metadata missing filename": {
      file: { id: "x", upload_metadata: `filetype ${b64("image/tiff")}` },
    },
    "metadata missing captureID": {
      file: { id: "x", upload_metadata: `filename ${b64("a.tif")}` },
    },
    "garbage metadata": { file: { id: "x", upload_metadata: "!!!!" } },
    "non-string metadata": { file: { id: "x", upload_metadata: 12345 } },
  };

  for (const [label, event] of Object.entries(hostileEvents)) {
    await t.test(`survives ${label}`, () => {
      assert.doesNotThrow(() => uploadFile.create(event));
      assert.strictEqual(saved.length, 0, "should not have saved a File");
    });
  }
});
