const fs = require('fs');
const config = require('../config');
module.exports = {
    _toSafeName: function (unsafeName) {
        return unsafeName.replace('&', 'and').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    },
    canAccessGroup: function (groupName, req) {

        if (!req.user) { //is a user
            return false;
        }

        if (config.admins.indexOf(req.user.username) > -1) { //is admin
            return true;
        }

        const currentUserGroups = req.user.memberOf;

        if (!groupName) {
            return false;
        }

        const match = config.groups.filter(g => {
            return g.safeName === groupName;
        });

        if (!match.length) {
            return false;
        }

        let inGroup = false;

        match[0].groupsWithAccess.map(gwa => {
            if (currentUserGroups.indexOf(gwa) > -1) {
                inGroup = true;
            }
        });

        return inGroup;


    },
    generateSafeName: function (name, list) { //$path, $filename

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
                    testName = safeName + '_' + testCount;
                } else {
                    canHave = true;
                    good(testName);
                }
            }
        })
    },
    ensureDir: function (path) {
        return new Promise((good, bad) => {
            fs.mkdir(path, function (err) {
                if (err) {
                    if (err.code === 'EEXIST') good(); // ignore the error if the folder already exists
                    else bad(err); // something else went wrong
                } else good(); // successfully created folde
            })
        })
    },
    move: function (oldPath, newPath) {
        return new Promise((good, bad) => {

            fs.rename(oldPath, newPath, function (err) {
                if (err) {
                    if (err.code === 'EXDEV') {
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

                readStream.on('error', bad);
                writeStream.on('error', bad);

                readStream.on('close', function () {
                    fs.unlink(oldPath, good);
                });

                readStream.pipe(writeStream);
            }
        })
    }
};