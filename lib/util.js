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
    }
};