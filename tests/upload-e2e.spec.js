const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const { signIn } = require("./helpers/e2eAuth");

/**
 * The upload round trip, driven through a real browser against a real server
 * and a real RethinkDB.
 *
 * This is the app's whole purpose and the one path unit tests cannot reach: the
 * tus handshake, the completion event, the MD5 in the pre-save hook, and the
 * move out of the staging directory into the storage tree. The move is where a
 * data-loss bug lived, so it is worth exercising for real.
 *
 * Everything is created through the actual forms (which also proves the CSRF
 * tokens work end to end) and removed again afterwards.
 */

const config = require("../config");
const STORAGE_ROOT = path.resolve(config.rootPath);
const STAGING_DIR = path.resolve(__dirname, "..", config.tusPath.replace(/^\//, ""));

// A group from config.js, seeded into the database at boot.
const GROUP = (config.groups[0] || {}).safeName;

const stamp = `${process.pid}${Date.now().toString(36)}`;
const PROJECT_NAME = `E2E Upload ${stamp}`;
const FILE_CONTENTS = Buffer.concat([
  Buffer.from("II*\0", "binary"), // plausible TIFF magic
  crypto.randomBytes(64 * 1024), // big enough to span several tus chunks
]);
const EXPECTED_MD5 = crypto.createHash("md5").update(FILE_CONTENTS).digest("hex");
const ORIGINAL_NAME = `e2e-capture-${stamp}.tif`;

let created = null; // { url, safeNames }
let tmpFile = null;

// Serial: each test builds on the upload the first one performs.
//
// retries: 1 because this drives a real browser through a chunked tus upload
// against a real server, and roughly one run in twenty-five trips over timing
// somewhere in that chain (not reproduced under observation). A genuine
// regression fails both attempts, so this hides flakes without hiding breakage.
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("file upload round trip", () => {
  test.beforeAll(() => {
    test.skip(!GROUP, "config.js defines no groups");
    tmpFile = path.join(os.tmpdir(), ORIGINAL_NAME);
    fs.writeFileSync(tmpFile, FILE_CONTENTS);
  });

  test.afterAll(async () => {
    if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    await cleanUp();
  });

  test("uploads a file and stores it under the capture", async ({ page }) => {
    test.setTimeout(120000);

    // Surface client-side failures: a throw inside the uploader would otherwise
    // just look like "the file list stayed empty".
    page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") {
        console.log("  [console]", m.type(), m.text());
      }
    });

    expect(await signIn(page), "could not sign in").toBe(true);

    created = await createCaptureChain(page);
    await page.goto(created.url);

    // The uploader only appears once its bundle has run.
    const trigger = page.locator("#uppy-trigger");
    await expect(trigger).toBeVisible();
    await page.waitForFunction(() => !!window.uploader);

    await trigger.click();

    // The modal is SweetAlert2; the input is hidden behind the drop zone.
    const fileInput = page.locator("#file-input");
    await expect(page.locator("#drop-zone")).toBeVisible();

    // The uploader attaches its change listener in SweetAlert's didOpen, which
    // only runs once the show animation ends. Setting the file before that is
    // silently lost. Wait for the animation class to be dropped.
    await page.waitForFunction(() => {
      const popup = document.querySelector(".swal2-popup");
      return !!popup && !popup.classList.contains("swal2-show");
    });

    await expect(async () => {
      // Assigning the same path twice fires no change event, so clear first --
      // otherwise a retry can never recover from a missed first attempt.
      await fileInput.setInputFiles([]);
      await fileInput.setInputFiles(tmpFile);
      await expect(page.locator("#file-list")).toContainText(ORIGINAL_NAME, {
        timeout: 2000,
      });
    }).toPass({ timeout: 20000 });

    await page.locator(".swal2-confirm").click();

    // The tus upload finishes, then the widget reports success.
    await expect(page.locator(".swal2-title")).toHaveText(/Upload Complete/i, {
      timeout: 60000,
    });
    await expect(page.locator(".swal2-html-container")).toContainText(
      /1 file\(s\) uploaded successfully/i,
    );
  });

  test("the file appears on the capture page", async ({ page }) => {
    expect(await signIn(page), "could not sign in").toBe(true);

    // The record is written by the server *after* the browser is told the
    // upload succeeded, so the page can briefly render without it.
    const card = await reloadUntil(
      page,
      created.url,
      () => page.locator(".card", { hasText: path.parse(ORIGINAL_NAME).name }),
      30000,
    );

    await expect(card).toContainText(path.parse(ORIGINAL_NAME).name);
    await expect(card).toContainText(".tif");
  });

  test("the stored bytes are byte-identical and the MD5 was recorded", async ({
    page,
  }) => {
    expect(await signIn(page), "could not sign in").toBe(true);
    await page.goto(created.url);

    const { safeNames } = created;
    const dir = path.join(
      STORAGE_ROOT,
      safeNames.group,
      safeNames.project,
      safeNames.sample,
      safeNames.experiment,
      safeNames.capture,
    );

    // Exactly one file, named by its tus id.
    expect(fs.existsSync(dir), `${dir} does not exist`).toBe(true);
    const stored = fs.readdirSync(dir);
    expect(stored).toHaveLength(1);

    const storedPath = path.join(dir, stored[0]);
    const bytes = fs.readFileSync(storedPath);
    expect(bytes.length).toBe(FILE_CONTENTS.length);
    expect(bytes.equals(FILE_CONTENTS)).toBe(true);

    // The staging copy must be gone: the pre-save hook moves, not copies.
    expect(
      fs.existsSync(path.join(STAGING_DIR, stored[0])),
      "the upload was left behind in the tus staging directory",
    ).toBe(false);

    // And the hash the model computed must match the real file.
    const record = await findFileRecord(stored[0]);
    expect(record, "no File record was written").toBeTruthy();
    expect(record.MD5).toBe(EXPECTED_MD5);
    expect(record.originalName).toBe(ORIGINAL_NAME);
  });

  test("the file downloads back intact under its original name", async ({ page }) => {
    expect(await signIn(page), "could not sign in").toBe(true);
    await page.goto(created.url);

    const downloadLink = page.locator('a.button.is-link[href*="/download"]').first();
    await expect(downloadLink).toBeVisible();
    const href = await downloadLink.getAttribute("href");

    // Fetch through the browser context so the session cookie is sent.
    const response = await page.request.get(href);
    expect(response.status()).toBe(200);

    const body = await response.body();
    expect(body.length).toBe(FILE_CONTENTS.length);
    expect(body.equals(FILE_CONTENTS)).toBe(true);

    expect(response.headers()["content-disposition"] || "").toContain(
      ORIGINAL_NAME,
    );
  });

  test("the copyable cluster path points at the stored file", async ({ page }) => {
    expect(await signIn(page), "could not sign in").toBe(true);

    const { safeNames } = created;
    const record = await findAnyFileRecordForCapture(created.captureID);
    expect(record).toBeTruthy();

    await page.goto(`${created.url}/${record.name}`);

    const expected = [
      config.HPCRoot,
      safeNames.group,
      safeNames.project,
      safeNames.sample,
      safeNames.experiment,
      safeNames.capture,
      record.name,
    ].join("/");

    // files/show.ejs used to build this from a field the model does not have,
    // and rendered "undefined" here.
    await expect(page.locator(".clipboard-button")).toContainText(expected);
    await expect(page.locator(".clipboard-button")).not.toContainText("undefined");
  });
});

/** Create project -> sample -> experiment -> capture through the real forms. */
async function createCaptureChain(page) {
  // The forms carry HTML validation the browser enforces before submitting:
  // shortDescription needs >= 20 characters and longDescription >= 100, so
  // these values have to be genuinely long enough.
  await page.goto(`/browse/${GROUP}/new`);
  await page.fill('input[name="name"]', PROJECT_NAME);
  await page.fill('[name="shortDescription"]', "Created by the upload end-to-end test");
  await page.fill(
    '[name="longDescription"]',
    "Created by the automated upload end-to-end test, which drives a real file " +
      "through the uploader and then removes everything it made afterwards.",
  );
  await submit(page);
  const projectUrl = page.url();

  await page.goto(`${projectUrl}/new`);
  await page.fill('input[name="name"]', `Sample ${stamp}`);
  await page.fill('[name="taxID"]', "4577");
  await page.fill('[name="scientificName"]', "Zea mays");
  await page.fill('[name="commonName"]', "maize");
  await submit(page);
  const sampleUrl = page.url();

  await page.goto(`${sampleUrl}/new`);
  await page.fill('input[name="name"]', `Experiment ${stamp}`);
  // description has minlength="20"
  await page.fill('[name="description"]', "Automated end-to-end upload check");
  await page.fill('[name="protocol"]', "none, created by a test");
  await submit(page);
  const experimentUrl = page.url();

  await page.goto(`${experimentUrl}/new`);
  await page.fill('input[name="name"]', `Capture ${stamp}`);
  await submit(page);
  const captureUrl = page.url();

  const parts = new URL(captureUrl).pathname.split("/").filter(Boolean);
  // /browse/:group/:project/:sample/:experiment/:capture
  expect(parts.length, `unexpected capture URL ${captureUrl}`).toBe(6);

  const hasUploader = await page.locator("#uppy-trigger").isVisible();
  const captureID = hasUploader
    ? await page.evaluate(() => window.uploader && window.uploader.captureID)
    : null;

  return {
    url: captureUrl,
    captureID,
    safeNames: {
      group: parts[1],
      project: parts[2],
      sample: parts[3],
      experiment: parts[4],
      capture: parts[5],
    },
  };
}

async function submit(page) {
  const before = page.url();

  await page.locator("button.is-success").click();

  // Wait for the redirect itself. waitForLoadState resolves immediately when
  // the page is already idle, which reads the old URL back.
  await page.waitForURL((url) => url.toString() !== before, { timeout: 30000 });
  await page.waitForLoadState("domcontentloaded");

  // A rejected form renders the error page rather than redirecting onwards.
  const heading = (await page.locator("h1.title").first().textContent()) || "";
  expect(
    heading,
    `form submission failed, landed on ${page.url()} showing "${heading.trim()}"`,
  ).not.toMatch(/Something went wrong|404|expired/i);
}

/** Reload until a locator shows up, for state the server writes asynchronously. */
async function reloadUntil(page, url, locatorFn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    await page.goto(url);
    last = locatorFn();
    if ((await last.count()) > 0) return last.first();
    await page.waitForTimeout(1000);
  }
  throw new Error(`nothing matched within ${timeoutMs}ms at ${url}`);
}

// --- database helpers, used only to verify and clean up -----------------------

let thinky = null;
function db() {
  if (!thinky) thinky = require("../lib/thinky");
  return thinky;
}

async function findFileRecord(name) {
  const r = db().r;
  const rows = await r.table("File").filter({ name }).run();
  return rows[0] || null;
}

async function findAnyFileRecordForCapture(captureID) {
  const r = db().r;
  if (captureID) {
    const rows = await r.table("File").filter({ captureID }).run();
    if (rows[0]) return rows[0];
  }
  const rows = await r.table("File").filter({ originalName: ORIGINAL_NAME }).run();
  return rows[0] || null;
}

// Every project this spec makes starts with this, so a run can clear up after
// an earlier one that died before its own cleanup.
const PROJECT_PREFIX = "E2E Upload ";

/**
 * Remove everything this spec created, in the database and on disk.
 *
 * Sweeps by name prefix rather than only this run's project: a run that fails
 * part-way used to leave an orphaned project and a held safe-name reservation
 * behind, and those accumulated.
 */
async function cleanUp() {
  try {
    const r = db().r;
    const safeNames = (created && created.safeNames) || null;

    const projects = await r
      .table("Project")
      .filter((row) => row("name").default("").match(`^${PROJECT_PREFIX}`))
      .run();
    for (const project of projects) {
      const samples = await r.table("Sample").filter({ projectID: project.id }).run();
      for (const sample of samples) {
        const experiments = await r
          .table("Experiment")
          .filter({ sampleID: sample.id })
          .run();
        for (const experiment of experiments) {
          const captures = await r
            .table("Capture")
            .filter({ experimentID: experiment.id })
            .run();
          for (const capture of captures) {
            await r.table("File").filter({ captureID: capture.id }).delete().run();
            await r.table("Capture").get(capture.id).delete().run();
          }
          await r.table("Experiment").get(experiment.id).delete().run();
        }
        await r.table("Sample").get(sample.id).delete().run();
      }
      await r.table("Project").get(project.id).delete().run();
    }

    // Release the safe-name reservations these projects held, otherwise the
    // names stay claimed forever and every later run gets a "_2" suffix.
    await r
      .table("SafeNameLock")
      .filter((row) => row("id").match("e2e_upload_"))
      .delete()
      .run()
      .catch(() => {});

    // And the directories, including any left by a previous failed run.
    const groupDir = path.join(STORAGE_ROOT, (safeNames && safeNames.group) || GROUP);
    if (fs.existsSync(groupDir)) {
      for (const entry of fs.readdirSync(groupDir)) {
        if (entry.startsWith("e2e_upload_")) {
          fs.rmSync(path.join(groupDir, entry), { recursive: true, force: true });
        }
      }
    }

    await r.getPoolMaster().drain();
  } catch (err) {
    console.error("upload e2e cleanup failed:", err.message);
  }
}
