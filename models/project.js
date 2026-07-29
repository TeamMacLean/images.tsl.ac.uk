const thinky = require("../lib/thinky");
const type = thinky.type;
const r = thinky.r;
const Util = require("../lib/util");
const safeName = require("../lib/safeName");
const config = require("../config");

const fs = require("fs");

const Project = thinky.createModel("Project", {
  id: type.string(),
  groupID: type.string().required(),
  createdAt: type.date().default(r.now()),
  updatedAt: type.date(),
  shortDescription: type.string().required(),
  longDescription: type.string().required(),
  name: type.string().required(),
  safeName: type.string().default(""),
  user: type.string(),
});

module.exports = Project;

Project.find = function (groupName, projectName) {
  return new Promise((good, bad) => {
    Project.filter({ safeName: projectName })
      .getJoin({ group: true, samples: true })
      .then((projects) => {
        const filteredProjects = projects.filter(
          (p) => p.group.safeName === groupName,
        );
        if (filteredProjects && filteredProjects.length) {
          return good(filteredProjects[0]);
        } else {
          bad(new Error("Project not found"));
        }
      })
      .catch((err) => {
        bad(err);
      });
  });
};

const Group = require("./group");
const Sample = require("./sample");

Project.pre("save", function (next) {
  const project = this;
  const OldSafeName = project.safeName;

  const scope = `project/${project.groupID}`;

  const GenerateSafeName = function () {
    // Only siblings in the same group can collide: a project is always looked
    // up through its group, and its directory lives inside the group's
    // directory. Scanning the whole table cost O(every project in the system)
    // in time and memory on every single save.
    return new Promise((good, bad) => {
      const siblings = project.groupID
        ? Project.getAll(project.groupID, { index: "groupID" }).run()
        : Promise.resolve([]);

      siblings
        .then((projects) => {
          projects = projects.filter((a) => a.id !== project.id);
          // Reserves the name, so two concurrent saves cannot both take it.
          return safeName.claim(scope, project.name, project.id, projects);
        })
        .then((claimed) => {
          project.safeName = claimed;
          return good(claimed);
        })
        .catch((err) => {
          return bad(err);
        });
    });
  };

  const MoveDirectory = function (oldName, newName) {
    return new Promise((good, bad) => {
      Group.get(project.groupID)
        .then((group) => {
          const oldFullPath = `${config.rootPath}/${group.safeName}/${oldName}`;
          const newFullPath = `${config.rootPath}/${group.safeName}/${newName}`;
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
      Group.get(project.groupID)
        .then((group) => {
          Util.ensureDir(
            `${config.rootPath}/${group.safeName}/${project.safeName}`,
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

  GenerateSafeName()
    .then(() => {
      if (OldSafeName) {
        if (project.safeName !== OldSafeName) {
          return MoveDirectory(OldSafeName, project.safeName).then(() =>
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
      if (project.safeName && project.safeName !== OldSafeName) {
        return safeName
          .release(scope, project.safeName)
          .then(() => next(err))
          .catch(() => next(err));
      }
      return next(err);
    });
});

// A brand new record has no id until it is written; record it on the lock
// afterwards so a later re-save recognises the name as its own.
Project.post("save", function (next) {
  safeName
    .assignOwner(`project/${this.groupID}`, this.safeName, this.id)
    .then(() => next())
    .catch(() => next());
});
Project.ensureIndex("createdAt");

Project.belongsTo(Group, "group", "groupID", "id");
Project.hasMany(Sample, "samples", "id", "projectID");
