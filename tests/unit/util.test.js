const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { stubConfig } = require("../helpers/stub");

const config = stubConfig();
const Util = require("../../lib/util");

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "imagehog-test-"));
}

test("_toSafeName", async (t) => {
  await t.test("lowercases and replaces punctuation with underscores", () => {
    assert.strictEqual(Util._toSafeName("My Project"), "my_project");
    assert.strictEqual(Util._toSafeName("Leaf #4 (rep 2)"), "leaf__4__rep_2_");
  });

  await t.test("keeps digits and letters", () => {
    assert.strictEqual(Util._toSafeName("Sample123"), "sample123");
  });

  await t.test("expands an ampersand", () => {
    assert.strictEqual(Util._toSafeName("Salt & Pepper"), "salt_and_pepper");
  });

  await t.test("never returns an empty name", () => {
    // An empty safe name collapses every path and URL built from it onto the
    // parent directory.
    assert.strictEqual(Util._toSafeName(""), "untitled");
    assert.notStrictEqual(Util._toSafeName(""), "");
  });

  await t.test("does not throw on non-string input", () => {
    assert.doesNotThrow(() => Util._toSafeName(null));
    assert.doesNotThrow(() => Util._toSafeName(undefined));
    assert.doesNotThrow(() => Util._toSafeName(42));
    assert.strictEqual(Util._toSafeName(42), "42");
  });

  await t.test("strips characters that would escape the storage root", () => {
    // Directory names are built from this, so traversal must not survive.
    const unsafe = Util._toSafeName("../../etc/passwd");
    assert.ok(!unsafe.includes("/"), `"${unsafe}" still contains a separator`);
    assert.ok(!unsafe.includes(".."), `"${unsafe}" still contains ".."`);
  });
});

test("generateSafeName", async (t) => {
  await t.test("returns the plain safe name when it is free", async () => {
    assert.strictEqual(await Util.generateSafeName("My Project", []), "my_project");
  });

  await t.test("suffixes a counter on collision", async () => {
    const existing = [{ safeName: "my_project" }];
    assert.strictEqual(
      await Util.generateSafeName("My Project", existing),
      "my_project_2",
    );
  });

  await t.test("keeps counting past repeated collisions", async () => {
    const existing = [
      { safeName: "my_project" },
      { safeName: "my_project_2" },
      { safeName: "my_project_3" },
    ];
    assert.strictEqual(
      await Util.generateSafeName("My Project", existing),
      "my_project_4",
    );
  });

  await t.test("tolerates a missing or ragged list", async () => {
    assert.strictEqual(await Util.generateSafeName("Thing", undefined), "thing");
    assert.strictEqual(
      await Util.generateSafeName("Thing", [null, {}, { safeName: "thing" }]),
      "thing_2",
    );
  });

  await t.test("rejects rather than hanging on a bad name", async () => {
    // A throw inside the promise executor used to escape as an unhandled
    // rejection, which terminates the process.
    await assert.doesNotReject(() => Util.generateSafeName(null, []));
  });

  await t.test("terminates on a large collision set", async () => {
    const existing = Array.from({ length: 200 }, (_, i) =>
      i === 0 ? { safeName: "x" } : { safeName: `x_${i + 1}` },
    );
    assert.strictEqual(await Util.generateSafeName("x", existing), "x_201");
  });
});

test("canAccessGroup", async (t) => {
  const member = {
    user: {
      username: "alice",
      memberOf: ["CN=alpha_modify,OU=groups,DC=example,DC=org"],
    },
  };

  await t.test("allows a member of a group with access", () => {
    assert.strictEqual(Util.canAccessGroup("alpha", member), true);
  });

  await t.test("denies a member of an unrelated group", () => {
    assert.strictEqual(Util.canAccessGroup("beta", member), false);
  });

  await t.test("matches LDAP group DNs case-insensitively", () => {
    const req = {
      user: {
        username: "alice",
        memberOf: ["cn=ALPHA_modify,ou=groups,dc=example,dc=org"],
      },
    };
    assert.strictEqual(Util.canAccessGroup("alpha", req), true);
  });

  await t.test("allows an admin into any group", () => {
    const admin = { user: { username: "adminuser", memberOf: ["CN=nothing"] } };
    assert.strictEqual(Util.canAccessGroup("beta", admin), true);
  });

  await t.test("denies unauthenticated and malformed requests", () => {
    assert.strictEqual(Util.canAccessGroup("alpha", undefined), false);
    assert.strictEqual(Util.canAccessGroup("alpha", {}), false);
    assert.strictEqual(Util.canAccessGroup("alpha", { user: {} }), false);
    assert.strictEqual(
      Util.canAccessGroup("alpha", { user: { username: "a", memberOf: [] } }),
      false,
    );
    assert.strictEqual(Util.canAccessGroup(undefined, member), false);
  });

  await t.test("denies an unknown group", () => {
    assert.strictEqual(Util.canAccessGroup("does-not-exist", member), false);
  });

  await t.test("denies, rather than throwing, when the group has no access list", () => {
    // config.example.js called this key adGroups; reading .some off undefined
    // threw straight out of the middleware.
    config.groups.push({ name: "Broken", safeName: "broken" });
    try {
      assert.doesNotThrow(() => Util.canAccessGroup("broken", member));
      assert.strictEqual(Util.canAccessGroup("broken", member), false);
    } finally {
      config.groups.pop();
    }
  });
});

test("ensureDir", async (t) => {
  await t.test("creates nested directories", async () => {
    const base = tmpdir();
    const target = path.join(base, "a", "b", "c");
    await Util.ensureDir(target);
    assert.ok(fs.statSync(target).isDirectory());
  });

  await t.test("is idempotent", async () => {
    const base = tmpdir();
    const target = path.join(base, "again");
    await Util.ensureDir(target);
    await assert.doesNotReject(() => Util.ensureDir(target));
  });

  await t.test("rejects when the path is not creatable", async () => {
    const base = tmpdir();
    const file = path.join(base, "afile");
    fs.writeFileSync(file, "x");
    await assert.rejects(() => Util.ensureDir(path.join(file, "child")));
  });
});

test("move", async (t) => {
  await t.test("renames within a filesystem", async () => {
    const base = tmpdir();
    const src = path.join(base, "src");
    const dst = path.join(base, "dst");
    fs.writeFileSync(src, "payload");

    await Util.move(src, dst);

    assert.strictEqual(fs.readFileSync(dst, "utf8"), "payload");
    assert.strictEqual(fs.existsSync(src), false);
  });

  await t.test("rejects when the source is missing", async () => {
    const base = tmpdir();
    await assert.rejects(() =>
      Util.move(path.join(base, "nope"), path.join(base, "dst")),
    );
  });

  // fs.rename cannot be made to fail with EXDEV portably, so force the
  // cross-device branch. Only rename is replaced; leaving the stream APIs
  // alone keeps this from disturbing anything else in the process.
  function forceCrossDevice(fn) {
    const realRename = fs.rename;
    fs.rename = (a, b, cb) => {
      const err = new Error("EXDEV: cross-device link not permitted");
      err.code = "EXDEV";
      cb(err);
    };
    return Promise.resolve()
      .then(fn)
      .finally(() => {
        fs.rename = realRename;
      });
  }

  await t.test(
    "keeps the source when a cross-device copy fails part-way",
    async () => {
      // Regression: the fallback unlinked the source as soon as the *read*
      // stream closed, so a destination that could not be written (a full
      // disk, an NFS dropout) destroyed the only copy of a just-uploaded
      // image. The upload is unrecoverable: no file, and no database row.
      const base = tmpdir();
      const src = path.join(base, "upload.tif");
      fs.writeFileSync(src, Buffer.alloc(64 * 1024, 7));

      // A destination inside a directory that does not exist: the write
      // stream errors instead of ever finishing.
      const dst = path.join(base, "no-such-dir", "dst.tif");

      await forceCrossDevice(async () => {
        await assert.rejects(() => Util.move(src, dst));
        assert.strictEqual(
          fs.existsSync(src),
          true,
          "source was deleted even though the copy failed",
        );
      });
    },
  );

  await t.test(
    "only resolves once the cross-device destination is complete",
    async () => {
      const base = tmpdir();
      const src = path.join(base, "big.bin");
      const dst = path.join(base, "big-moved.bin");
      const SIZE = 512 * 1024;
      fs.writeFileSync(src, Buffer.alloc(SIZE, 3));

      await forceCrossDevice(async () => {
        await Util.move(src, dst);
        assert.strictEqual(
          fs.statSync(dst).size,
          SIZE,
          "resolved before the destination was fully written",
        );
        assert.strictEqual(fs.existsSync(src), false);
      });
    },
  );

  await t.test("leaves no half-written file behind on failure", async () => {
    const base = tmpdir();
    const src = path.join(base, "upload.tif");
    fs.writeFileSync(src, Buffer.alloc(64 * 1024, 7));
    const dst = path.join(base, "no-such-dir", "dst.tif");

    await forceCrossDevice(async () => {
      await assert.rejects(() => Util.move(src, dst));
      assert.strictEqual(fs.existsSync(dst), false);
    });
  });
});
