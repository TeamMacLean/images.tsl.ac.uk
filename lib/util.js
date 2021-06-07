const fs = require('fs');
const config = require('../config');
module.exports = {
    _toSafeName: function (unsafeName) {
        return unsafeName.replace('&', 'and').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    },
    canAccessGroup: function (groupSafeName, req) {
        
        console.log('canAccessGroup reached');
        
        if (!req.user){
            console.error('No req.user object found', req)
            return false;
        } else if (!groupSafeName){
            console.error('no groupSafeName found')
            return false;
        } else if (!req.user.username){
            console.error('no req.user.username found');
            return false;
        } else if (!req.user.memberOf || !req.user.memberOf.length){
            console.error('no req.user.memberOf (or no length at least)')
            return false;
        } else if (!config || !config.groups || !config.groups.length) {
            console.error('no config groups found')
            return false;
        } else {
            console.log('no errors in initial info', groupSafeName, req.user);            
        }

        const allGroupSafeNames = config.groups.map(g => g.safeName);
        if (config.groups.length !== allGroupSafeNames.length){
            console.error('cannot find correct number of config group safe names')
            return false;
        } else {
            console.log('all group safenames', allGroupSafeNames);
        }   

        // find the config group object to compare to req data
        const filtered = config.groups.filter(g => {
            return g.safeName === groupSafeName;
        });
        if (filtered.length !== 1) {
            console.error('could not find 1 exact match in config groups for target safe name')
            return false;
        }
        const match = filtered[0];
        
        let inGroup = false;
        let userIsAdmin = config.admins && config.admins.length && config.admins.indexOf(req.user.username) > -1;
        
        const currentUserGroups = req.user.memberOf;
        match.groupsWithAccess.map(gwa => {
            if (currentUserGroups.indexOf(gwa) > -1) {
                inGroup = true;
            }
        });

        console.log('userIsAdmin', userIsAdmin, 'inGroup', inGroup, 'match.groupsWithAccess', match.groupsWithAccess);
        console.log('we want match.groupsWithAccess to be in req.user.memberOf in order for a match');
                
        return userIsAdmin || inGroup;

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