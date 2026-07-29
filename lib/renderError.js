const config = require("../config");

/**
 * Render the error page for a failed request.
 *
 * @param res Express response
 * @param err the error to report
 * @returns {String|*|void}
 */
module.exports = function (res, err) {
    console.error(err);

    // This has been called as renderError(err) by mistake, which threw inside a
    // .catch() and took the process down as an unhandled rejection.
    if (!res || typeof res.render !== 'function') {
        console.error('renderError called without a response object');
        return;
    }

    return res.status(500).render('error', {
        error: err,
        // Stack traces belong in the logs, not in front of users.
        showStack: !!config.developmentMode,
    });
};
