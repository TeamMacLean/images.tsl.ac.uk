const fs = require('fs');
module.exports = {
    _toSafeName: function (unsafeName) {
        return unsafeName.replace('&', 'and').replace(/[^a-z0-9]/gi, '_').toLowerCase();
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