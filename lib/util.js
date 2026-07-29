const fs = require("fs");
const config = require("../config");
module.exports = {
  _toSafeName: function (unsafeName) {
    if (typeof unsafeName !== "string") {
      unsafeName = unsafeName == null ? "" : String(unsafeName);
    }
    const safeName = unsafeName
      .replace("&", "and")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    // An empty safe name collapses every path and URL built from it onto the
    // parent directory, so never hand one back.
    return safeName === "" ? "untitled" : safeName;
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

    // A group configured without groupsWithAccess grants access to nobody
    // rather than throwing (config.example.js historically called it adGroups).
    const groupsWithAccess = Array.isArray(match.groupsWithAccess)
      ? match.groupsWithAccess
      : [];

    // Use case-insensitive comparison for group matching
    const inGroup = groupsWithAccess.some(function (gwa) {
      return req.user.memberOf.some(function (userGroup) {
        return userGroup.toLowerCase() === gwa.toLowerCase();
      });
    });

    console.log(`
        User: ${req.user.username}
        LDAP Groups: ${req.user.memberOf}
        Groups With Access: ${groupsWithAccess}
        Admin Privileges: ${userIsAdmin}
        In Group: ${inGroup}
        Result: ${userIsAdmin || inGroup}
    `);

    return userIsAdmin || inGroup;
  },
  generateSafeName: function (name, list) {
    //$path, $filename

    return new Promise((good, bad) => {
      try {
        const safeName = this._toSafeName(name);
        const taken = new Set(
          (Array.isArray(list) ? list : [])
            .map((item) => item && item.safeName)
            .filter(Boolean),
        );

        let testName = safeName;
        let testCount = 1;

        while (taken.has(testName)) {
          testCount += 1;
          testName = safeName + "_" + testCount;
        }

        good(testName);
      } catch (err) {
        bad(err);
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

      // fs.rename cannot move across filesystems, so fall back to copy+delete.
      // The source is only unlinked once the destination has fully flushed:
      // deleting it on the read stream closing destroys the only copy of the
      // file whenever the write later fails (ENOSPC, an NFS dropout, ...).
      function copy() {
        const readStream = fs.createReadStream(oldPath);
        const writeStream = fs.createWriteStream(newPath);
        let settled = false;

        const fail = function (err) {
          if (settled) return;
          settled = true;
          readStream.destroy();
          writeStream.destroy();
          // Leave no half-written file behind; the source is still intact.
          fs.unlink(newPath, function () {
            bad(err);
          });
        };

        readStream.on("error", fail);
        writeStream.on("error", fail);

        writeStream.on("finish", function () {
          if (settled) return;
          settled = true;
          fs.unlink(oldPath, function (err) {
            if (err) {
              bad(err);
            } else {
              good();
            }
          });
        });

        readStream.pipe(writeStream);
      }
    });
  },
};
