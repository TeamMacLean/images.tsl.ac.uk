const thinky = require("../lib/thinky");
const r = thinky.r;
const Util = require("../lib/util");
const safeName = require("../lib/safeName");
const config = require("../config");

const fs = require("fs");

const Capture = thinky.createModel("Capture", {
  id: thinky.type.string(),
  experimentID: thinky.type.string().required(),
  createdAt: thinky.type.date().default(r.now()),
  updatedAt: thinky.type.date(),
  name: thinky.type.string().required(),
  safeName: thinky.type.string().default(""),

  platformName: thinky.type.string().required(),
  // platformLens: type.string().required(),
  // platformCamera: type.string().required(),
  // platformGain: type.string().required()
  user: thinky.type.string(),
});

module.exports = Capture;

Capture.find = function (
  groupName,
  projectName,
  sampleName,
  experimentName,
  captureName,
) {
  return new Promise((good, bad) => {
    Capture.filter({ safeName: captureName })
      .getJoin({
        experiment: { sample: { project: { group: true } } },
        files: true,
      })
      .then((captures) => {
        const capturessFiltered = captures.filter(
          (c) =>
            c.experiment.sample.project.group.safeName === groupName &&
            c.experiment.sample.project.safeName === projectName &&
            c.experiment.sample.safeName === sampleName &&
            c.experiment.safeName === experimentName,
        );
        if (capturessFiltered && capturessFiltered.length) {
          return good(capturessFiltered[0]);
        } else {
          return bad(new Error("Capture not found"));
        }
      })
      .catch((err) => {
        return bad(err);
      });
  });
};

// const Sample = require('./sample');
const Experiment = require("./experiment");
const File = require("./file");

Capture.pre("save", function (next) {
  const capture = this;
  const OldSafeName = capture.safeName;

  const scope = `capture/${capture.experimentID}`;

  const GenerateSafeName = function () {
    // Only siblings in the same experiment can collide; see models/project.js.
    // Captures are the highest-volume records here, so this was the worst of
    // the four full-table scans.
    return new Promise((good, bad) => {
      const siblings = capture.experimentID
        ? Capture.getAll(capture.experimentID, { index: "experimentID" }).run()
        : Promise.resolve([]);

      siblings
        .then((captures) => {
          captures = captures.filter((a) => a.id !== capture.id);
          return safeName.claim(scope, capture.name, capture.id, captures);
        })
        .then((claimed) => {
          capture.safeName = claimed;
          return good(claimed);
        })
        .catch((err) => {
          return bad(err);
        });
    });
  };

  const MakeDirectory = function () {
    return new Promise((good, bad) => {
      Experiment.get(capture.experimentID)
        .getJoin({ sample: { project: { group: true } } })
        .then((experiment) => {
          Util.ensureDir(
            `${config.rootPath}/${experiment.sample.project.group.safeName}/${experiment.sample.project.safeName}/${experiment.sample.safeName}/${experiment.safeName}/${capture.safeName}`,
          )
            .then(() => {
              good();
            })
            .catch((err) => {
              console.error(err);
              bad(err);
            });
        })
        .catch((err) => {
          console.error(err);
          bad(err);
        });
    });
  };

  const MoveDirectory = function (oldName, newName) {
    return new Promise((good, bad) => {
      Experiment.get(capture.experimentID)
        .getJoin({ sample: { project: { group: true } } })
        .then((experiment) => {
          const oldFullPath = `${config.rootPath}/${experiment.sample.project.group.safeName}/${experiment.sample.project.safeName}/${experiment.sample.safeName}/${experiment.safeName}/${oldName}`;
          const newFullPath = `${config.rootPath}/${experiment.sample.project.group.safeName}/${experiment.sample.project.safeName}/${experiment.sample.safeName}/${experiment.safeName}/${newName}`;
          fs.rename(oldFullPath, newFullPath, function (err) {
            if (err) {
              bad(err);
            } else {
              good();
            }
          });
        })
        .catch((err) => {
          console.error(err);
          bad(err);
        });
    });
  };

  GenerateSafeName()
    .then(() => {
      if (OldSafeName) {
        if (capture.safeName !== OldSafeName) {
          return MoveDirectory(OldSafeName, capture.safeName).then(() =>
            // The old name is free again now the directory has moved.
            safeName.release(scope, OldSafeName),
          );
        } else {
          return Promise.resolve();
        }
      } else {
        return MakeDirectory();
      }
    })
    .then(() => next())
    .catch((err) => {
      // The save is going to fail, so don't sit on a name nobody is using.
      if (capture.safeName && capture.safeName !== OldSafeName) {
        return safeName
          .release(scope, capture.safeName)
          .then(() => next(err))
          .catch(() => next(err));
      }
      return next(err);
    });
});

// A brand new record has no id until it is written; record it on the lock
// afterwards so a later re-save recognises the name as its own.
Capture.post("save", function (next) {
  safeName
    .assignOwner(`capture/${this.experimentID}`, this.safeName, this.id)
    .then(() => next())
    .catch(() => next());
});

Capture.ensureIndex("createdAt");

Capture.belongsTo(Experiment, "experiment", "experimentID", "id");
Capture.hasMany(File, "files", "id", "captureID");
