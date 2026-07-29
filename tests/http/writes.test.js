const test = require("node:test");
const assert = require("node:assert");

const { stubConfig } = require("../helpers/stub");
const fakeModels = require("../helpers/fakeModels");
const { start } = require("../helpers/httpClient");

stubConfig({ developmentMode: true });
const { db, faults } = fakeModels.install();
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

test("creating records", async (t) => {
  await t.test("a project redirects to the new project", async () => {
    const res = await client.postForm("/browse/alpha/new", {
      name: "Fresh Project",
      shortDescription: "short",
      longDescription: "long",
    });
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.get("location"), "/browse/alpha/fresh_project");
  });

  await t.test("a second project of the same name gets its own URL", async () => {
    const res = await client.postForm("/browse/alpha/new", {
      name: "Fresh Project",
      shortDescription: "short",
      longDescription: "long",
    });
    assert.strictEqual(
      res.headers.get("location"),
      "/browse/alpha/fresh_project_2",
      "duplicate names collapsed onto one URL",
    );
  });

  await t.test("a sample redirects to the new sample", async () => {
    const res = await client.postForm("/browse/alpha/proj/new", {
      name: "Fresh Sample",
      taxID: "4577",
      scientificName: "Zea mays",
      commonName: "maize",
    });
    assert.strictEqual(res.status, 302);
    assert.strictEqual(
      res.headers.get("location"),
      "/browse/alpha/proj/fresh_sample",
    );
  });

  await t.test("an experiment redirects to the new experiment", async () => {
    const res = await client.postForm("/browse/alpha/proj/samp/new", {
      name: "Fresh Experiment",
      protocol: "p",
      description: "d",
    });
    assert.strictEqual(res.status, 302);
    assert.strictEqual(
      res.headers.get("location"),
      "/browse/alpha/proj/samp/fresh_experiment",
    );
  });

  await t.test("a capture redirects to the new capture", async () => {
    const res = await client.postForm("/browse/alpha/proj/samp/exp/new", {
      name: "Fresh Capture",
      platformName: "Leica SP8",
    });
    assert.strictEqual(res.status, 302);
    assert.strictEqual(
      res.headers.get("location"),
      "/browse/alpha/proj/samp/exp/fresh_capture",
    );
  });
});

test("posting to a parent that does not exist", async (t) => {
  // These chains had no .catch(), so the request hung and the unhandled
  // rejection terminated the process.
  const cases = [
    ["/browse/nosuchgroup/new", { name: "x", shortDescription: "s", longDescription: "l" }],
    ["/browse/alpha/nosuch/new", { name: "x", taxID: "1", scientificName: "s", commonName: "c" }],
    ["/browse/alpha/proj/nosuch/new", { name: "x", protocol: "p", description: "d" }],
    ["/browse/alpha/proj/samp/nosuch/new", { name: "x", platformName: "p" }],
  ];

  for (const [url, fields] of cases) {
    await t.test(url, async () => {
      const res = await client.postForm(url, fields);
      assert.ok(
        res.status === 404 || res.status >= 500,
        `${url} returned ${res.status}`,
      );
      // The point of the test: the server is still up.
      const after = await client.get("/signin");
      assert.strictEqual(after.status, 200, "server died after the request");
    });
  }
});

test("a failing save is reported rather than hanging", async (t) => {
  await t.test("returns an error page and keeps serving", async () => {
    faults.failSave = new Error("write failed");

    const res = await client.postForm("/browse/alpha/new", {
      name: "Doomed Project",
      shortDescription: "s",
      longDescription: "l",
    });
    assert.ok(res.status >= 400, `expected an error status, got ${res.status}`);

    const after = await client.get("/signin");
    assert.strictEqual(after.status, 200, "server died after a failed save");
  });
});

test("editing an existing record", async (t) => {
  await t.test("posting with an id updates rather than creating", async () => {
    const created = await client.postForm("/browse/alpha/new", {
      name: "Renameable",
      shortDescription: "s",
      longDescription: "l",
    });
    const safeName = created.headers.get("location").split("/").pop();
    const project = db.projects.find((p) => p.safeName === safeName);
    const countBefore = db.projects.length;

    const res = await client.postForm("/browse/alpha/new", {
      id: project.id,
      name: "Renameable",
      shortDescription: "updated short",
      longDescription: "updated long",
    });

    assert.strictEqual(res.status, 302);
    assert.strictEqual(db.projects.length, countBefore, "created instead of updated");
    assert.strictEqual(project.shortDescription, "updated short");
  });

  await t.test("posting an unknown id does not hang or crash", async () => {
    const res = await client.postForm("/browse/alpha/new", {
      id: "no-such-id",
      name: "Ghost",
      shortDescription: "s",
      longDescription: "l",
    });
    assert.ok(res.status >= 400, `expected an error status, got ${res.status}`);

    const after = await client.get("/signin");
    assert.strictEqual(after.status, 200, "server died after an unknown id");
  });
});

test("record names are escaped when they come back out", async (t) => {
  await t.test("a script tag in a project name is neutralised", async () => {
    const created = await client.postForm("/browse/alpha/new", {
      name: `Nasty <script>alert(1)</script>`,
      shortDescription: `desc <script>alert(1)</script>`,
      longDescription: "l",
    });
    const location = created.headers.get("location");
    assert.strictEqual(created.status, 302);

    const page = await client.get(location);
    assert.strictEqual(page.status, 200);
    assert.ok(
      !page.body.includes("<script>alert(1)</script>"),
      "stored script tag was echoed back raw",
    );

    const listing = await client.get("/browse/alpha");
    assert.ok(
      !listing.body.includes("<script>alert(1)</script>"),
      "stored script tag was echoed back raw in the project listing",
    );
  });
});
