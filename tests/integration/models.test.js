const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const { stubConfig } = require("../helpers/stub");

const ROOT_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "imagehog-int-"));

stubConfig({
  developmentMode: false,
  rethinkdb: { host: "localhost", port: 28015, db: "imagehog_test" },
  rootPath: ROOT_PATH,
});

function reachable(port, host, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

// These exercise the pre-save hooks, which are where safe names are allocated
// and directories are created and renamed. Skipped rather than failed when
// there is no RethinkDB to talk to, so the suite stays useful everywhere.
test(
  "model save hooks (requires RethinkDB on localhost:28015)",
  async (t) => {
    if (!(await reachable(28015, "localhost"))) {
      return t.skip("RethinkDB not reachable on localhost:28015");
    }

    const thinky = require("../../lib/thinky");
    const Group = require("../../models/group");
    const Project = require("../../models/project");
    const Sample = require("../../models/sample");

    // thinky creates tables lazily; wait for them before touching anything.
    await thinky.dbReady();

    const stamp = process.pid + "-" + process.hrtime.bigint();
    const groupSafeName = `itest_${stamp}`.replace(/[^a-z0-9_]/gi, "_").toLowerCase();

    const group = await new Group({
      name: `Integration ${stamp}`,
      safeName: groupSafeName,
    }).save();

    t.after(async () => {
      // Delete through r.table, not the model: Model.delete() re-validates the
      // documents and throws on any row this suite deliberately left partial.
      const r = thinky.r;
      await r
        .table("Project")
        .getAll(group.id, { index: "groupID" })
        .delete()
        .run()
        .catch(() => {});
      await r.table("Group").get(group.id).delete().run().catch(() => {});
      await thinky.r.getPoolMaster().drain();
      fs.rmSync(ROOT_PATH, { recursive: true, force: true });
    });

    await t.test("creating a group creates its directory", () => {
      assert.ok(
        fs.existsSync(path.join(ROOT_PATH, groupSafeName)),
        "group directory was not created",
      );
    });

    await t.test("a project gets a safe name derived from its name", async () => {
      const project = await new Project({
        groupID: group.id,
        name: `My First Project ${stamp}`,
        shortDescription: "short",
        longDescription: "long",
      }).save();

      assert.match(project.safeName, /^my_first_project_/);
      assert.ok(
        fs.existsSync(path.join(ROOT_PATH, groupSafeName, project.safeName)),
        "project directory was not created",
      );
    });

    await t.test("two projects with the same name get distinct safe names", async () => {
      const name = `Duplicate ${stamp}`;
      const first = await new Project({
        groupID: group.id,
        name,
        shortDescription: "a",
        longDescription: "a",
      }).save();
      const second = await new Project({
        groupID: group.id,
        name,
        shortDescription: "b",
        longDescription: "b",
      }).save();

      assert.notStrictEqual(
        first.safeName,
        second.safeName,
        "duplicate names collided onto one safe name and one directory",
      );
      assert.ok(fs.existsSync(path.join(ROOT_PATH, groupSafeName, second.safeName)));
    });

    await t.test("renaming a project moves its directory", async () => {
      const project = await new Project({
        groupID: group.id,
        name: `Before ${stamp}`,
        shortDescription: "s",
        longDescription: "l",
      }).save();
      const oldSafeName = project.safeName;
      const oldDir = path.join(ROOT_PATH, groupSafeName, oldSafeName);
      assert.ok(fs.existsSync(oldDir));

      // Leave a file behind to prove the contents travel with the rename.
      fs.writeFileSync(path.join(oldDir, "marker.txt"), "keep me");

      project.name = `After ${stamp}`;
      const renamed = await project.save();

      assert.notStrictEqual(renamed.safeName, oldSafeName);
      const newDir = path.join(ROOT_PATH, groupSafeName, renamed.safeName);
      assert.ok(fs.existsSync(newDir), "new directory missing after rename");
      assert.strictEqual(fs.existsSync(oldDir), false, "old directory left behind");
      assert.strictEqual(
        fs.readFileSync(path.join(newDir, "marker.txt"), "utf8"),
        "keep me",
        "directory contents were lost in the rename",
      );
    });

    await t.test("a sample nests under its project directory", async () => {
      const project = await new Project({
        groupID: group.id,
        name: `Nesting ${stamp}`,
        shortDescription: "s",
        longDescription: "l",
      }).save();

      const sample = await new Sample({
        projectID: project.id,
        name: `Leaf ${stamp}`,
        taxID: "4577",
        scientificName: "Zea mays",
        commonName: "maize",
      }).save();

      assert.ok(
        fs.existsSync(
          path.join(ROOT_PATH, groupSafeName, project.safeName, sample.safeName),
        ),
        "sample directory was not created under its project",
      );
    });

    await t.test(
      "the same project name in two groups keeps a clean safe name in each",
      async () => {
        // Safe names only have to be unique among siblings: a project is always
        // resolved through its group, and its directory lives inside the
        // group's directory. Making them globally unique meant loading every
        // project in the system on every save.
        const otherGroupSafeName = `${groupSafeName}_other`;
        const otherGroup = await new Group({
          name: `Integration Other ${stamp}`,
          safeName: otherGroupSafeName,
        }).save();

        t.after(async () => {
          const r = thinky.r;
          await r
            .table("Project")
            .getAll(otherGroup.id, { index: "groupID" })
            .delete()
            .run()
            .catch(() => {});
          await r.table("Group").get(otherGroup.id).delete().run().catch(() => {});
        });

        const name = `Shared Name ${stamp}`;
        const inFirst = await new Project({
          groupID: group.id,
          name,
          shortDescription: "s",
          longDescription: "l",
        }).save();
        const inSecond = await new Project({
          groupID: otherGroup.id,
          name,
          shortDescription: "s",
          longDescription: "l",
        }).save();

        assert.strictEqual(
          inFirst.safeName,
          inSecond.safeName,
          "an unrelated group's project should not force a _2 suffix",
        );

        // Both must still resolve, each through its own group.
        assert.strictEqual(
          (await Project.find(groupSafeName, inFirst.safeName)).id,
          inFirst.id,
        );
        assert.strictEqual(
          (await Project.find(otherGroupSafeName, inSecond.safeName)).id,
          inSecond.id,
        );

        // And they occupy separate directories.
        assert.ok(
          fs.existsSync(path.join(ROOT_PATH, groupSafeName, inFirst.safeName)),
        );
        assert.ok(
          fs.existsSync(
            path.join(ROOT_PATH, otherGroupSafeName, inSecond.safeName),
          ),
        );
      },
    );

    await t.test(
      "experiments and captures nest and rename correctly too",
      async () => {
        const Experiment = require("../../models/experiment");
        const Capture = require("../../models/capture");

        const project = await new Project({
          groupID: group.id,
          name: `Deep ${stamp}`,
          shortDescription: "s",
          longDescription: "l",
        }).save();
        const sample = await new Sample({
          projectID: project.id,
          name: `Deep Sample ${stamp}`,
          taxID: "4577",
          scientificName: "Zea mays",
          commonName: "maize",
        }).save();
        const experiment = await new Experiment({
          sampleID: sample.id,
          name: `Deep Experiment ${stamp}`,
          protocol: "p",
          description: "d",
        }).save();
        const capture = await new Capture({
          experimentID: experiment.id,
          name: `Deep Capture ${stamp}`,
          platformName: "Leica SP8",
        }).save();

        const captureDir = path.join(
          ROOT_PATH,
          groupSafeName,
          project.safeName,
          sample.safeName,
          experiment.safeName,
          capture.safeName,
        );
        assert.ok(
          fs.existsSync(captureDir),
          "capture directory was not created at the full depth",
        );

        // Renaming a capture must move its directory, contents and all.
        fs.writeFileSync(path.join(captureDir, "image.tif"), "bytes");
        capture.name = `Deep Capture Renamed ${stamp}`;
        const renamed = await capture.save();

        const newDir = path.join(
          ROOT_PATH,
          groupSafeName,
          project.safeName,
          sample.safeName,
          experiment.safeName,
          renamed.safeName,
        );
        assert.ok(fs.existsSync(newDir), "renamed capture directory missing");
        assert.strictEqual(fs.existsSync(captureDir), false, "old directory left behind");
        assert.strictEqual(
          fs.readFileSync(path.join(newDir, "image.tif"), "utf8"),
          "bytes",
          "capture contents lost in the rename",
        );

        // And it still resolves through the whole chain.
        const found = await Capture.find(
          groupSafeName,
          project.safeName,
          sample.safeName,
          experiment.safeName,
          renamed.safeName,
        );
        assert.strictEqual(found.id, capture.id);
      },
    );

    await t.test(
      "concurrent creates of the same name never share a safe name",
      async () => {
        // The read-then-write allocation used to let simultaneous saves both
        // take the same name: one record became unreachable and the two shared
        // a directory. Names are now reserved before anything is created.
        const CONCURRENCY = 12;
        const name = `Race ${stamp}`;

        const created = await Promise.all(
          Array.from({ length: CONCURRENCY }, () =>
            new Project({
              groupID: group.id,
              name,
              shortDescription: "s",
              longDescription: "l",
            }).save(),
          ),
        );

        const names = created.map((p) => p.safeName);
        assert.strictEqual(
          new Set(names).size,
          CONCURRENCY,
          `duplicate safe names allocated: ${names.sort().join(", ")}`,
        );

        // Each must have its own directory, and each must resolve back to
        // exactly the record that created it.
        for (const project of created) {
          assert.ok(
            fs.existsSync(path.join(ROOT_PATH, groupSafeName, project.safeName)),
            `no directory for ${project.safeName}`,
          );
          const found = await Project.find(groupSafeName, project.safeName);
          assert.strictEqual(found.id, project.id);
        }
      },
    );

    await t.test("a renamed record frees its old name for reuse", async () => {
      const first = await new Project({
        groupID: group.id,
        name: `Recycle ${stamp}`,
        shortDescription: "s",
        longDescription: "l",
      }).save();
      const originalSafeName = first.safeName;

      first.name = `Recycle Moved ${stamp}`;
      await first.save();
      assert.notStrictEqual(first.safeName, originalSafeName);

      // The vacated name should be handed out cleanly, not skipped to _2.
      const second = await new Project({
        groupID: group.id,
        name: `Recycle ${stamp}`,
        shortDescription: "s",
        longDescription: "l",
      }).save();
      assert.strictEqual(
        second.safeName,
        originalSafeName,
        "the freed name was not reused",
      );
    });

    await t.test("Project.find only matches within the right group", async () => {
      const project = await new Project({
        groupID: group.id,
        name: `Scoped ${stamp}`,
        shortDescription: "s",
        longDescription: "l",
      }).save();

      const found = await Project.find(groupSafeName, project.safeName);
      assert.strictEqual(found.id, project.id);

      await assert.rejects(
        () => Project.find("some-other-group", project.safeName),
        "found a project through the wrong group",
      );
    });
  },
);
