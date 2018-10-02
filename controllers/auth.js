const passport = require('passport');

module.exports = {
    signIn: (req, res, next) => {
        res.render('auth/signin');
    },
    signOut: (req, res, next) => {
        req.logout();
        res.redirect('/');
    },
    signInPost: (req, res, next) => {

        passport.authenticate('ldapauth', (err, user, info) => {
            if (err) {
                console.error(err);
                return next(err);
            }
            if (info) {
                console.log(info);
            }
            if (!user) {
                var message = 'No such user';
                if (info && info.message) {
                    message += ', ' + info.message;
                }
                return res.render('error', {error: message});
            }
            req.logIn(user, function (err) {
                if (err) {
                    return next(err);
                }
                //take them to the page they wanted before signing in :)
                if (req.session.returnTo) {
                    return res.redirect(req.session.returnTo);
                } else {
                    return res.redirect('/');
                }
            });
        })(req, res, next);

    }
};