const thinky = require("../lib/thinky");
const type = thinky.type;
const r = thinky.r;
const Util = require("../lib/util");
const safeName = require("../lib/safeName");
const config = require("../config");

const fs = require("fs");

const Sample = thinky.createModel("Sample", {
  id: type.string(),
  projectID: type.string().required(),
  createdAt: type.date().default(r.now()),
  updatedAt: type.date(),
  name: type.string().required(),
  safeName: type.string().default(""),
  protocol: type.string(),
  taxID: type.string().required(),
  scientificName: type.string().required(),
  commonName: type.string().required(),
  user: type.string(),
});

module.exports = Sample;

Sample.defineStatic("find", function (groupName, projectName, sampleName) {
  return new Promise((good, bad) => {
    Sample.filter({ safeName: sampleName })
      .getJoin({
        experiments: true,
        project: { group: true },
      })
      .then((samples) => {
        const samplesFiltered = samples.filter(
          (s) =>
            s.project.group.safeName === groupName &&
            s.project.safeName === projectName,
        );
        if (samplesFiltered && samplesFiltered.length) {
          return good(samplesFiltered[0]);
        } else {
          return bad(new Error("Sample not found"));
        }
      })
      .catch((err) => {
        return bad(err);
      });
  });
});

const Project = require("./project");
const Experiment = require("./experiment");

Sample.pre("save", function (next) {
  const sample = this;
  const OldSafeName = sample.safeName;

  const scope = `sample/${sample.projectID}`;

  const GenerateSafeName = function () {
    // Only siblings in the same project can collide; see models/project.js.
    return new Promise((good, bad) => {
      const siblings = sample.projectID
        ? Sample.getAll(sample.projectID, { index: "projectID" }).run()
        : Promise.resolve([]);

      siblings
        .then((samples) => {
          samples = samples.filter((a) => a.id !== sample.id);
          return safeName.claim(scope, sample.name, sample.id, samples);
        })
        .then((claimed) => {
          sample.safeName = claimed;
          return good(claimed);
        })
        .catch((err) => {
          return bad(err);
        });
    });
  };

  const MoveDirectory = function (oldName, newName) {
    return new Promise((good, bad) => {
      Project.get(sample.projectID)
        .getJoin({ group: true })
        .then((project) => {
          const oldFullPath = `${config.rootPath}/${project.group.safeName}/${project.safeName}/${oldName}`;
          const newFullPath = `${config.rootPath}/${project.group.safeName}/${project.safeName}/${newName}`;
          fs.rename(oldFullPath, newFullPath, function (err) {
            if (err) {
              bad(err);
            } else {
              good(newName);
            }
          });
        })
        .catch((err) => {
          console.error(err);
          bad(err);
        });
    });
  };

  const MakeDirectory = function () {
    return new Promise((good, bad) => {
      Project.get(sample.projectID)
        .getJoin({ group: true })
        .then((project) => {
          Util.ensureDir(
            `${config.rootPath}/${project.group.safeName}/${project.safeName}/${sample.safeName}`,
          )
            .then(() => {
              return good();
            })
            .catch((err) => {
              console.error(err);
              return bad(err);
            });
        })
        .catch((err) => {
          console.error(err);
          return bad(err);
        });
    });
  };

  GenerateSafeName()
    .then(() => {
      if (OldSafeName) {
        if (sample.safeName !== OldSafeName) {
          return MoveDirectory(OldSafeName, sample.safeName).then(() =>
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
      if (sample.safeName && sample.safeName !== OldSafeName) {
        return safeName
          .release(scope, sample.safeName)
          .then(() => next(err))
          .catch(() => next(err));
      }
      return next(err);
    });
});

// A brand new record has no id until it is written; record it on the lock
// afterwards so a later re-save recognises the name as its own.
Sample.post("save", function (next) {
  safeName
    .assignOwner(`sample/${this.projectID}`, this.safeName, this.id)
    .then(() => next())
    .catch(() => next());
});
Sample.ensureIndex("createdAt");

Sample.belongsTo(Project, "project", "projectID", "id");
Sample.hasMany(Experiment, "experiments", "id", "sampleID");
