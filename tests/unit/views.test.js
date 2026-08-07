const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const ejs = require("ejs");

const { ROOT } = require("../helpers/stub");

const VIEWS = path.join(ROOT, "views");

// A payload that escapes its attribute or element context if it is written out
// raw. If it survives intact anywhere, that view has an XSS hole.
const XSS = `"><script>alert(1)</script>`;
const ESCAPED_MARKER = "&lt;script&gt;";

function render(view, locals = {}) {
  return ejs.renderFile(path.join(VIEWS, view), locals, {
    // Matches how Express resolves the include() paths in these templates.
    views: [VIEWS],
    filename: path.join(VIEWS, view),
  });
}

const config = { HPCRoot: "/hpc/images" };

function makeGroup() {
  return { id: "g1", name: `Group ${XSS}`, safeName: "alpha", projects: [] };
}

function makeProject(group = makeGroup()) {
  return {
    id: "p1",
    name: `Project ${XSS}`,
    safeName: "proj",
    shortDescription: `short ${XSS}`,
    longDescription: `long ${XSS}`,
    user: `user ${XSS}`,
    group,
    samples: [],
  };
}

function makeSample(project = makeProject()) {
  return {
    id: "s1",
    name: `Sample ${XSS}`,
    safeName: "samp",
    taxID: `4577 ${XSS}`,
    scientificName: `Zea mays ${XSS}`,
    commonName: `maize ${XSS}`,
    protocol: `protocol ${XSS}`,
    user: `user ${XSS}`,
    project,
    experiments: [],
  };
}

function makeExperiment(sample = makeSample()) {
  return {
    id: "e1",
    name: `Experiment ${XSS}`,
    safeName: "exp",
    description: `description ${XSS}`,
    protocol: `protocol ${XSS}`,
    user: `user ${XSS}`,
    sample,
    captures: [],
  };
}

function makeFile(capture) {
  return {
    id: "f1",
    name: "abc123",
    originalName: `image ${XSS}.tif`,
    type: `image/tiff ${XSS}`,
    description: `file description ${XSS}`,
    capture,
    extention: () => ".tif",
    parsedName: () => `image ${XSS}`,
  };
}

function makeCapture(experiment = makeExperiment()) {
  const capture = {
    id: "c1",
    name: `Capture ${XSS}`,
    safeName: "cap",
    platformName: `Leica ${XSS}`,
    user: `user ${XSS}`,
    experiment,
    files: [],
  };
  capture.files.push(makeFile(capture));
  return capture;
}

/** Every view, with locals shaped the way its controller supplies them. */
function allViews() {
  const group = makeGroup();
  const project = makeProject();
  project.samples.push(makeSample(project));
  const sample = makeSample();
  sample.experiments.push(makeExperiment(sample));
  const experiment = makeExperiment();
  experiment.captures.push(makeCapture(experiment));
  const capture = makeCapture();
  const groupWithProjects = makeGroup();
  groupWithProjects.projects.push(makeProject(groupWithProjects));

  return [
    ["404.ejs", {}],
    ["error.ejs", { error: new Error(`boom ${XSS}`), showStack: false }],
    ["auth/signin.ejs", { developmentMode: false }],
    ["help/index.ejs", {}],
    ["admin/index.ejs", {}],
    ["groups/index.ejs", { groups: [makeGroup(), makeGroup()] }],
    ["groups/show.ejs", { group: groupWithProjects, config }],
    ["projects/new.ejs", { group }],
    ["projects/show.ejs", { project, config }],
    ["projects/edit.ejs", { project: makeProject() }],
    ["samples/new.ejs", { project: makeProject() }],
    ["samples/show.ejs", { sample, config }],
    ["samples/edit.ejs", { sample: makeSample() }],
    ["experiments/new.ejs", { sample: makeSample() }],
    ["experiments/show.ejs", { experiment, config }],
    ["experiments/edit.ejs", { experiment: makeExperiment() }],
    ["captures/new.ejs", { experiment: makeExperiment() }],
    ["captures/show.ejs", { capture, config }],
    ["captures/edit.ejs", { capture: makeCapture() }],
    ["files/show.ejs", { file: makeFile(makeCapture()), config }],
  ];
}

test("every view renders without throwing", async (t) => {
  for (const [view, locals] of allViews()) {
    await t.test(view, async () => {
      const html = await render(view, locals);
      assert.ok(html.length > 0, "rendered nothing");
    });
  }
});

test("no view emits user-supplied data unescaped", async (t) => {
  for (const [view, locals] of allViews()) {
    await t.test(view, async () => {
      const html = await render(view, locals);
      assert.ok(
        !html.includes("<script>alert(1)</script>"),
        `${view} rendered an injected <script> tag verbatim`,
      );
    });
  }
});

test("stored values are escaped, not dropped", async (t) => {
  await t.test("project name survives as escaped text", async () => {
    const html = await render("projects/show.ejs", {
      project: makeProject(),
      config,
    });
    assert.ok(html.includes(ESCAPED_MARKER), "payload was not escaped into the page");
    assert.ok(html.includes("Project"), "the real name was lost");
  });

  await t.test("a quote in a name cannot break out of an attribute", async () => {
    const group = makeGroup();
    group.image = `/img/x.jpg" onerror="alert(1)`;
    const html = await render("groups/index.ejs", { groups: [group] });
    assert.ok(!html.includes('onerror="alert(1)"'));
  });
});

test("file detail page", async (t) => {
  await t.test("renders the HPC path from the file's real fields", async () => {
    // files/show.ejs included _hpc_path.ejs without passing HPCPath (so the
    // include threw), and built the path from a non-existent file.safeName.
    const html = await render("files/show.ejs", {
      file: makeFile(makeCapture()),
      config,
    });
    assert.ok(
      html.includes("/hpc/images/alpha/proj/samp/exp/cap/abc123"),
      "HPC path is wrong or missing",
    );
    assert.ok(!html.includes("undefined"), "HPC path contains 'undefined'");
  });
});

test("error view", async (t) => {
  await t.test("hides the stack unless explicitly asked for", async () => {
    const err = new Error("kaboom");
    const html = await render("error.ejs", { error: err, showStack: false });
    assert.ok(html.includes("kaboom"));
    assert.ok(!html.includes(err.stack), "leaked a stack trace to the client");
  });

  await t.test("shows the stack in development", async () => {
    const err = new Error("kaboom");
    const html = await render("error.ejs", { error: err, showStack: true });
    assert.ok(html.includes("at "), "expected a stack trace");
  });

  await t.test("renders a plain string error", async () => {
    // isInGroup used to pass a bare string, where error.stack is undefined.
    const html = await render("error.ejs", { error: "no permission" });
    assert.ok(html.includes("no permission"));
    assert.ok(!html.includes("undefined"));
  });

  await t.test("renders with no error at all", async () => {
    const html = await render("error.ejs", { error: undefined });
    assert.ok(html.includes("Something went wrong"));
  });
});

test("every form is well formed and carries its token in the body", async (t) => {
  // The CSRF include was once inserted into the middle of a multi-line <form>
  // tag, landing inside the action attribute. The token was present, so a test
  // that only grepped for name="_csrf" passed, while every form in the app
  // pointed at a garbage URL and could not be submitted at all.
  const formViews = [
    ["auth/signin.ejs", { developmentMode: false }],
    ["projects/new.ejs", { group: makeGroup() }],
    ["projects/edit.ejs", { project: makeProject() }],
    ["samples/new.ejs", { project: makeProject() }],
    ["samples/edit.ejs", { sample: makeSample() }],
    ["experiments/new.ejs", { sample: makeSample() }],
    ["experiments/edit.ejs", { experiment: makeExperiment() }],
    ["captures/new.ejs", { experiment: makeExperiment() }],
    ["captures/edit.ejs", { capture: makeCapture() }],
  ];

  for (const [view, locals] of formViews) {
    await t.test(view, async () => {
      const html = await render(view, { ...locals, csrfToken: "t".repeat(64) });

      const openTag = html.match(/<form\b[^>]*>/);
      assert.ok(openTag, `${view} rendered no <form> tag`);

      const action = openTag[0].match(/action="([^"]*)"/);
      assert.ok(action, `${view}: form has no action attribute`);
      assert.ok(
        action[1].startsWith("/"),
        `${view}: action "${action[1]}" is not a site-relative path`,
      );
      assert.ok(
        !/[<>\n%]/.test(action[1]),
        `${view}: action "${action[1]}" contains markup, so the tag is malformed`,
      );

      // The token must be an element inside the form, not text in the tag.
      const tokenIndex = html.indexOf('name="_csrf"');
      assert.ok(tokenIndex > -1, `${view}: no _csrf field`);
      assert.ok(
        tokenIndex > openTag.index + openTag[0].length,
        `${view}: the _csrf field is inside the <form> tag itself`,
      );
      assert.match(
        html.slice(tokenIndex - 60, tokenIndex + 120),
        /<input[^>]+name="_csrf"[^>]+value="t{64}"/,
        `${view}: the _csrf field did not render as an input with the token`,
      );
    });
  }
});

test("groups/show tolerates a project with no description", async () => {
  // .substring() on a missing shortDescription threw and 500'd the group page.
  const group = makeGroup();
  const project = makeProject(group);
  delete project.shortDescription;
  group.projects.push(project);

  await assert.doesNotReject(() => render("groups/show.ejs", { group, config }));
});
