const path = require("node:path");
const { ROOT, stubModule } = require("./stub");

/**
 * In-memory stand-ins for the thinky models.
 *
 * They implement the small surface the controllers actually use, with the same
 * contract that matters for routing: find() *rejects* when nothing matches.
 * That is what made the missing .catch() blocks in the controllers fatal.
 */
function install() {
  const db = {
    groups: [],
    projects: [],
    samples: [],
    experiments: [],
    captures: [],
    files: [],
  };

  // Set by a test to make the next query or save blow up, exercising the
  // error paths.
  const faults = { failNext: null, failSave: null };

  function maybeFail() {
    if (faults.failNext) {
      const err = faults.failNext;
      faults.failNext = null;
      return Promise.reject(err);
    }
    return null;
  }

  const notFound = (what) => Promise.reject(new Error(`${what} not found`));

  // The real models allocate safeName in a pre-save hook and the controllers
  // redirect to it, so the fakes have to do the same or the POST paths cannot
  // be exercised meaningfully.
  const Util = require(path.join(ROOT, "lib", "util"));

  class Base {
    constructor(fields) {
      Object.assign(this, fields);
    }
    save() {
      if (faults.failSave) {
        const err = faults.failSave;
        faults.failSave = null;
        return Promise.reject(err);
      }

      const collection = db[this.constructor.collection];
      if (!this.name) {
        return Promise.reject(new Error("Value for [name] must be defined."));
      }
      if (!this.safeName) {
        const base = Util._toSafeName(this.name);
        let candidate = base;
        let n = 1;
        while (collection.some((x) => x !== this && x.safeName === candidate)) {
          n += 1;
          candidate = `${base}_${n}`;
        }
        this.safeName = candidate;
      }
      if (!this.id) {
        this.id = `${this.constructor.collection}-${collection.length + 1}`;
      }
      this.constructor.hydrate(this);
      if (!collection.includes(this)) collection.push(this);
      return Promise.resolve(this);
    }
    /** Attach the parent object the way getJoin() would. */
    static hydrate() {}
  }

  class Group extends Base {
    static collection = "groups";

    static run() {
      return maybeFail() || Promise.resolve(db.groups);
    }
    static filter(pred) {
      return {
        run: () =>
          maybeFail() ||
          Promise.resolve(
            db.groups.filter((g) => g.safeName === pred.safeName),
          ),
      };
    }
    static find(safeName) {
      const fail = maybeFail();
      if (fail) return fail;
      const group = db.groups.find((g) => g.safeName === safeName);
      return group ? Promise.resolve(group) : notFound("Group");
    }
    static get(id) {
      const group = db.groups.find((g) => g.id === id);
      return group ? Promise.resolve(group) : notFound("Group");
    }
  }

  class Project extends Base {
    static collection = "projects";
    static hydrate(p) {
      p.group = db.groups.find((g) => g.id === p.groupID) || p.group;
      p.samples = p.samples || [];
      if (p.group && !p.group.projects.includes(p)) p.group.projects.push(p);
    }

    static find(groupName, projectName) {
      const fail = maybeFail();
      if (fail) return fail;
      const project = db.projects.find(
        (p) => p.safeName === projectName && p.group.safeName === groupName,
      );
      return project ? Promise.resolve(project) : notFound("Project");
    }
    static filter(pred) {
      return {
        getJoin: () => ({
          run: () =>
            maybeFail() ||
            Promise.resolve(
              db.projects.filter((p) => p.safeName === pred.safeName),
            ),
        }),
      };
    }
    static get(id) {
      const project = db.projects.find((p) => p.id === id);
      return project ? Promise.resolve(project) : notFound("Project");
    }
  }

  class Sample extends Base {
    static collection = "samples";
    static hydrate(s) {
      s.project = db.projects.find((p) => p.id === s.projectID) || s.project;
      s.experiments = s.experiments || [];
      if (s.project && !s.project.samples.includes(s)) s.project.samples.push(s);
    }

    static find(groupName, projectName, sampleName) {
      const fail = maybeFail();
      if (fail) return fail;
      const sample = db.samples.find(
        (s) =>
          s.safeName === sampleName &&
          s.project.safeName === projectName &&
          s.project.group.safeName === groupName,
      );
      return sample ? Promise.resolve(sample) : notFound("Sample");
    }
    static get(id) {
      const sample = db.samples.find((s) => s.id === id);
      return sample ? Promise.resolve(sample) : notFound("Sample");
    }
  }

  class Experiment extends Base {
    static collection = "experiments";
    static hydrate(e) {
      e.sample = db.samples.find((s) => s.id === e.sampleID) || e.sample;
      e.captures = e.captures || [];
      if (e.sample && !e.sample.experiments.includes(e)) e.sample.experiments.push(e);
    }

    static find(groupName, projectName, sampleName, experimentName) {
      const fail = maybeFail();
      if (fail) return fail;
      const experiment = db.experiments.find(
        (e) =>
          e.safeName === experimentName &&
          e.sample.safeName === sampleName &&
          e.sample.project.safeName === projectName &&
          e.sample.project.group.safeName === groupName,
      );
      return experiment ? Promise.resolve(experiment) : notFound("Experiment");
    }
    static get(id) {
      const experiment = db.experiments.find((e) => e.id === id);
      return experiment ? Promise.resolve(experiment) : notFound("Experiment");
    }
  }

  class Capture extends Base {
    static collection = "captures";
    static hydrate(c) {
      c.experiment = db.experiments.find((e) => e.id === c.experimentID) || c.experiment;
      c.files = c.files || [];
      if (c.experiment && !c.experiment.captures.includes(c)) c.experiment.captures.push(c);
    }

    static find(groupName, projectName, sampleName, experimentName, captureName) {
      const fail = maybeFail();
      if (fail) return fail;
      const capture = db.captures.find(
        (c) =>
          c.safeName === captureName &&
          c.experiment.safeName === experimentName &&
          c.experiment.sample.safeName === sampleName &&
          c.experiment.sample.project.safeName === projectName &&
          c.experiment.sample.project.group.safeName === groupName,
      );
      return capture ? Promise.resolve(capture) : notFound("Capture");
    }
    static get(id) {
      const capture = db.captures.find((c) => c.id === id);
      return capture ? Promise.resolve(capture) : notFound("Capture");
    }
  }

  class File extends Base {
    static collection = "files";

    static find(
      groupName,
      projectName,
      sampleName,
      experimentName,
      captureName,
      fileName,
    ) {
      const fail = maybeFail();
      if (fail) return fail;
      const file = db.files.find(
        (f) =>
          f.name === fileName &&
          f.capture.safeName === captureName &&
          f.capture.experiment.safeName === experimentName &&
          f.capture.experiment.sample.safeName === sampleName &&
          f.capture.experiment.sample.project.safeName === projectName &&
          f.capture.experiment.sample.project.group.safeName === groupName,
      );
      return file ? Promise.resolve(file) : notFound("File");
    }
  }

  stubModule(path.join(ROOT, "models", "group.js"), Group);
  stubModule(path.join(ROOT, "models", "project.js"), Project);
  stubModule(path.join(ROOT, "models", "sample.js"), Sample);
  stubModule(path.join(ROOT, "models", "experiment.js"), Experiment);
  stubModule(path.join(ROOT, "models", "capture.js"), Capture);
  stubModule(path.join(ROOT, "models", "file.js"), File);

  // app.js pulls `r` out of lib/thinky purely to hand to the session store.
  stubModule(path.join(ROOT, "lib", "thinky.js"), { r: {}, type: {} });
  // Keep sessions in memory instead of RethinkDB.
  stubModule("session-rethinkdb", (session) => session.MemoryStore);

  return { db, faults, Group, Project, Sample, Experiment, Capture, File };
}

/** Build a linked group -> project -> sample -> experiment -> capture -> file. */
function seed(db, { groupSafeName = "alpha", xss = "" } = {}) {
  const group = {
    id: "g1",
    name: `Alpha Group${xss}`,
    safeName: groupSafeName,
    projects: [],
  };
  const project = {
    id: "p1",
    name: `Project One${xss}`,
    safeName: "proj",
    shortDescription: `short${xss}`,
    longDescription: `long${xss}`,
    group,
    samples: [],
  };
  group.projects.push(project);
  const sample = {
    id: "s1",
    name: `Sample One${xss}`,
    safeName: "samp",
    taxID: "4577",
    scientificName: `Zea mays${xss}`,
    commonName: `maize${xss}`,
    project,
    experiments: [],
  };
  project.samples.push(sample);
  const experiment = {
    id: "e1",
    name: `Experiment One${xss}`,
    safeName: "exp",
    description: `desc${xss}`,
    protocol: `proto${xss}`,
    sample,
    captures: [],
  };
  sample.experiments.push(experiment);
  const capture = {
    id: "c1",
    name: `Capture One${xss}`,
    safeName: "cap",
    platformName: `Leica${xss}`,
    experiment,
    files: [],
  };
  experiment.captures.push(capture);
  const file = {
    id: "f1",
    name: "abc123",
    originalName: `image${xss}.tif`,
    type: "image/tiff",
    description: `filedesc${xss}`,
    capture,
    extention: () => ".tif",
    parsedName: () => `image${xss}`,
  };
  capture.files.push(file);

  db.groups.push(group);
  db.projects.push(project);
  db.samples.push(sample);
  db.experiments.push(experiment);
  db.captures.push(capture);
  db.files.push(file);

  return { group, project, sample, experiment, capture, file };
}

module.exports = { install, seed };
