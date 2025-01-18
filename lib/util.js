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
    // Validate input
    if (!req?.user?.username || !req.user.memberOf?.length || !groupSafeName) {
      console.error(
        "Missing required data: req.user, req.user.memberOf, or groupSafeName"
      );
      return false;
    }
    if (!config?.groups?.length) {
      console.error("No config groups found");
      return false;
    }

    // Ensure group safe names are unique
    const allGroupSafeNames = new Set(config.groups.map((g) => g.safeName));
    if (allGroupSafeNames.size !== config.groups.length) {
      console.error("Duplicate group safe names in config");
      return false;
    }

    // Locate the target group
    const match = config.groups.find((g) => g.safeName === groupSafeName);
    if (!match) {
      console.error(`No matching group found for safeName: ${groupSafeName}`);
      return false;
    }

    // Check user membership or admin privileges
    const userIsAdmin = config.admins?.includes(req.user.username);
    const inGroup = match.groupsWithAccess.some((gwa) =>
      req.user.memberOf.includes(gwa)
    );

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
      fs.mkdir(path, function (err) {
        if (err) {
          if (err.code === "EEXIST")
            good(); // ignore the error if the folder already exists
          else bad(err); // something else went wrong
        } else good(); // successfully created folde
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
