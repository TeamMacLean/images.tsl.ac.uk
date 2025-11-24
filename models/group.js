const thinky = require("../lib/thinky");
const type = thinky.type;
const r = thinky.r;
const config = require("../config");
const Util = require("../lib/util");

const Group = thinky.createModel("Group", {
  id: type.string(),
  createdAt: type.date().default(r.now()),
  updatedAt: type.date(),
  name: type.string().required(),
  safeName: type.string().required(),
});

module.exports = Group;

Group.preSave = function () {
  const dirPath = config.rootPath + "/" + this.safeName;
  return new Promise((resolve) => {
    Util.ensureDir(dirPath)
      .then(() => {
        console.log(`✓ Group directory ready: ${dirPath}`);
        resolve();
      })
      .catch((err) => {
        console.error(`✗ Failed to create group directory: ${dirPath}`);
        console.error("Error details:", err.message);
        // Continue anyway - directory will be created on first file upload
        console.log(
          "→ Continuing without directory (will be created on demand)",
        );
        resolve();
      });
  });
};

const originalSave = Group.prototype.save;
Group.prototype.save = function (...args) {
  return Group.preSave.call(this).then(() => {
    return originalSave.apply(this, args);
  });
};

Group.find = function (groupName) {
  return new Promise((good, bad) => {
    Group.filter({ safeName: groupName })
      .getJoin({ projects: true })
      .then((groups) => {
        if (groups && groups.length) {
          return good(groups[0]);
        } else {
          bad(new Error("Group not found"));
        }
      })
      .catch((err) => {
        bad(err);
      });
  });
};

Group.ensureIndex("createdAt");

const Project = require("./project");
Group.hasMany(Project, "projects", "id", "groupID");
