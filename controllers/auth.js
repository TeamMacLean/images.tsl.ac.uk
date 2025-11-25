const passport = require("passport");
const config = require("../config");

module.exports = {
  signIn: (req, res, next) => {
    res.render("auth/signin", { developmentMode: config.developmentMode });
  },
  signOut: (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  },
  signInPost: (req, res, next) => {
    // Development mode bypass - any username/password works
    if (config.developmentMode) {
      const username = req.body.username;
      const isAdmin = config.admins.includes(username);

      const devUser = {
        id: username,
        username: username,
        name: username,
        mail: `${username}@dev.local`,
        memberOf: [],
        isAdmin: isAdmin,
      };

      req.logIn(devUser, function (err) {
        if (err) {
          return next(err);
        }
        console.log(
          "Development mode: User logged in as",
          username,
          isAdmin ? "(ADMIN)" : "",
        );
        if (req.session.returnTo) {
          return res.redirect(req.session.returnTo);
        } else {
          return res.redirect("/");
        }
      });
      return;
    }

    passport.authenticate("ldapauth", (err, user, info) => {
      if (err) {
        console.error(err);
        return next(err);
      }
      if (info) {
        console.log(info);
      }
      if (!user) {
        let message = "No such user";
        if (info && info.message) {
          message += ", " + info.message;
        }
        return res.render("error", { error: message });
      }
      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }
        //take them to the page they wanted before signing in :)
        if (req.session.returnTo) {
          return res.redirect(req.session.returnTo);
        } else {
          return res.redirect("/");
        }
      });
    })(req, res, next);
  },
};
