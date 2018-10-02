/**
 *
 * @param res
 * @param err
 * @returns {String|*|void}
 */
module.exports = function (res, err) {
    console.error(err);
    if (res) {
        return res.render('error', {error: err});
    }
};