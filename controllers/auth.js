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
    // req.logIn regenerates the session to prevent session fixation, which
    // discards returnTo. Read it before logging in, not after.
    const returnTo = safeReturnTo(req.session.returnTo);

    // Development mode bypass - any username/password works
    if (config.developmentMode) {
      const username = req.body.username;

      if (!username) {
        return res.status(400).render("error", {
          error: "A username is required",
        });
      }

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
        return res.redirect(returnTo);
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
        return res.redirect(returnTo);
      });
    })(req, res, next);
  },
};

/**
 * Only ever redirect to a path on this site. returnTo is set from req.path so
 * it is already local, but a value that ever became attacker-controlled would
 * otherwise turn the login form into an open redirect.
 */
function safeReturnTo(returnTo) {
  if (typeof returnTo !== "string") return "/";
  if (!returnTo.startsWith("/")) return "/";
  // "//evil.example" and "/\evil.example" are protocol-relative URLs.
  if (returnTo.startsWith("//") || returnTo.startsWith("/\\")) return "/";
  return returnTo;
}
