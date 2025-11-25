const fs = require("fs");
const config = require("../config");
module.exports = {
  _toSafeName: function (unsafeName) {
    return unsafeName
      .replace("&", "and")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
  },
  canAccessGroup: function (groupSafeName, req) {
    // In development mode, allow access to all groups
    if (config.developmentMode) {
      return true;
    }

    // Validate input
    if (
      !req ||
      !req.user ||
      !req.user.username ||
      !Array.isArray(req.user.memberOf) ||
      req.user.memberOf.length === 0 ||
      !groupSafeName
    ) {
      console.error(
        "Missing required data: req.user, req.user.memberOf, or groupSafeName",
      );
      return false;
    }
    if (
      !config ||
      !Array.isArray(config.groups) ||
      config.groups.length === 0
    ) {
      console.error("No config groups found");
      return false;
    }

    // Ensure group safe names are unique
    const allGroupSafeNames = config.groups.map(function (g) {
      return g.safeName;
    });
    const uniqueGroupSafeNames = new Set(allGroupSafeNames);
    if (uniqueGroupSafeNames.size !== config.groups.length) {
      console.error("Duplicate group safe names in config");
      return false;
    }

    // Locate the target group
    const match = config.groups.find(function (g) {
      return g.safeName === groupSafeName;
    });
    if (!match) {
      console.error(`No matching group found for safeName: ${groupSafeName}`);
      return false;
    }

    // Check user membership or admin privileges
    const userIsAdmin =
      config.admins &&
      Array.isArray(config.admins) &&
      config.admins.includes(req.user.username);

    // Use case-insensitive comparison for group matching
    const inGroup = match.groupsWithAccess.some(function (gwa) {
      return req.user.memberOf.some(function (userGroup) {
        return userGroup.toLowerCase() === gwa.toLowerCase();
      });
    });

    console.log(`
        User: ${req.user.username}
        LDAP Groups: ${req.user.memberOf}
        Groups With Access: ${match.groupsWithAccess}
        Admin Privileges: ${userIsAdmin}
        In Group: ${inGroup}
        Result: ${userIsAdmin || inGroup}
    `);

    return userIsAdmin || inGroup;
  },
  generateSafeName: function (name, list) {
    //$path, $filename

    return new Promise((good, bad) => {
      const safeName = this._toSafeName(name);
      let canHave = false;
      let testName = safeName;
      let testCount = 1;

      const filter = function (res) {
        return res.safeName === testName;
      };

      while (!canHave) {
        const dupes = list.filter(filter);

        if (dupes.length) {
          testCount += 1;
          testName = safeName + "_" + testCount;
        } else {
          canHave = true;
          good(testName);
        }
      }
    });
  },
  ensureDir: function (path) {
    return new Promise((good, bad) => {
      fs.mkdir(path, { recursive: true }, function (err) {
        if (err) {
          if (err.code === "EEXIST") {
            good(); // ignore the error if the folder already exists
          } else {
            console.error(`Failed to create directory: ${path}`, err);
            bad(err); // something else went wrong
          }
        } else {
          console.log(`✓ Created directory: ${path}`);
          good(); // successfully created folder
        }
      });
    });
  },
  move: function (oldPath, newPath) {
    return new Promise((good, bad) => {
      fs.rename(oldPath, newPath, function (err) {
        if (err) {
          if (err.code === "EXDEV") {
            copy();
          } else {
            bad(err);
          }
          return;
        }
        good();
      });

      function copy() {
        const readStream = fs.createReadStream(oldPath);
        const writeStream = fs.createWriteStream(newPath);

        readStream.on("error", bad);
        writeStream.on("error", bad);

        readStream.on("close", function () {
          fs.unlink(oldPath, good);
        });

        readStream.pipe(writeStream);
      }
    });
  },
};
