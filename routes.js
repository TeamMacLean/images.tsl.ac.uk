const express = require("express");
const router = express.Router();

const Auth = require("./controllers/auth");
const Groups = require("./controllers/groups");
const Projects = require("./controllers/projects");
// const Admin = require('./controllers/admin');
const Experiments = require("./controllers/experiments");
const Captures = require("./controllers/captures");
const Samples = require("./controllers/samples");
const Files = require("./controllers/files");
const Help = require("./controllers/help");

const Util = require("./lib/util");
const config = require("./config");

router
  .route("/")
  .all(isAuthenticated)
  .get((req, res, next) => {
    console.log("GET /");
    next();
  }, Groups.index);

router
  .route("/signin")
  .get((req, res, next) => {
    console.log("GET /signin");
    next();
  }, Auth.signIn)
  .post((req, res, next) => {
    console.log("POST /signin");
    next();
  }, Auth.signInPost);

router.route("/signout").get((req, res, next) => {
  console.log("GET /signout");
  next();
}, Auth.signOut);

router
  .route("/help")
  .all(isAuthenticated)
  .get((req, res, next) => {
    console.log("GET /help");
    next();
  }, Help.index);

router
  .route("/browse/:group")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(`GET /browse/${req.params.group}`);
    next();
  }, Groups.show);

router
  .route("/browse/:group/new")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(`GET /browse/${req.params.group}/new`);
    next();
  }, Projects.new)
  .post((req, res, next) => {
    console.log(`POST /browse/${req.params.group}/new`);
    next();
  }, Projects.save);

router
  .route("/browse/:group/:project")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(`GET /browse/${req.params.group}/${req.params.project}`);
    next();
  }, Projects.show);

router
  .route("/browse/:group/:project/edit")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(`GET /browse/${req.params.group}/${req.params.project}/edit`);
    next();
  }, Projects.edit);

router
  .route("/browse/:group/:project/new")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(`GET /browse/${req.params.group}/${req.params.project}/new`);
    next();
  }, Samples.new)
  .post((req, res, next) => {
    console.log(`POST /browse/${req.params.group}/${req.params.project}/new`);
    next();
  }, Samples.save);

router
  .route("/browse/:group/:project/:sample")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(
      `GET /browse/${req.params.group}/${req.params.project}/${req.params.sample}`,
    );
    next();
  }, Samples.show);

router
  .route("/browse/:group/:project/:sample/edit")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(
      `GET /browse/${req.params.group}/${req.params.project}/${req.params.sample}/edit`,
    );
    next();
  }, Samples.edit);

router
  .route("/browse/:group/:project/:sample/new")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(
      `GET /browse/${req.params.group}/${req.params.project}/${req.params.sample}/new`,
    );
    next();
  }, Experiments.new)
  .post((req, res, next) => {
    console.log(
      `POST /browse/${req.params.group}/${req.params.project}/${req.params.sample}/new`,
    );
    next();
  }, Experiments.save);

router
  .route("/browse/:group/:project/:sample/:experiment")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(
      `GET /browse/${req.params.group}/${req.params.project}/${req.params.sample}/${req.params.experiment}`,
    );
    next();
  }, Experiments.show);

router
  .route("/browse/:group/:project/:sample/:experiment/edit")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(
      `GET /browse/${req.params.group}/${req.params.project}/${req.params.sample}/${req.params.experiment}/edit`,
    );
    next();
  }, Experiments.edit);

router
  .route("/browse/:group/:project/:sample/:experiment/new")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(
      `GET /browse/${req.params.group}/${req.params.project}/${req.params.sample}/${req.params.experiment}/new`,
    );
    next();
  }, Captures.new)
  .post((req, res, next) => {
    console.log(
      `POST /browse/${req.params.group}/${req.params.project}/${req.params.sample}/${req.params.experiment}/new`,
    );
    next();
  }, Captures.save);

router
  .route("/browse/:group/:project/:sample/:experiment/:capture")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(
      `GET /browse/${req.params.group}/${req.params.project}/${req.params.sample}/${req.params.experiment}/${req.params.capture}`,
    );
    next();
  }, Captures.show);

router
  .route("/browse/:group/:project/:sample/:experiment/:capture/edit")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(
      `GET /browse/${req.params.group}/${req.params.project}/${req.params.sample}/${req.params.experiment}/${req.params.capture}/edit`,
    );
    next();
  }, Captures.edit);

router
  .route("/browse/:group/:project/:sample/:experiment/:capture/:file")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(
      `GET /browse/${req.params.group}/${req.params.project}/${req.params.sample}/${req.params.experiment}/${req.params.capture}/${req.params.file}`,
    );
    next();
  }, Files.show);

router
  .route("/browse/:group/:project/:sample/:experiment/:capture/:edit")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(
      `GET /browse/${req.params.group}/${req.params.project}/${req.params.sample}/${req.params.experiment}/${req.params.capture}/${req.params.edit}`,
    );
    next();
  }, Files.edit);

router
  .route("/browse/:group/:project/:sample/:experiment/:capture/:file/:download")
  .all([isAuthenticated, isInGroup])
  .get((req, res, next) => {
    console.log(
      `GET /browse/${req.params.group}/${req.params.project}/${req.params.sample}/${req.params.experiment}/${req.params.capture}/${req.params.file}/download`,
    );
    next();
  }, Files.download);

router.route("*").get((req, res, next) => {
  console.log("GET * - Rendering 404 for:", req.url);
  return res.status(404).render("404");
});

module.exports = router;

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    console.log("User is authenticated");
    return next();
  } else {
    console.log("User is not authenticated, redirecting to /signin");
    req.session.returnTo = req.path;
    return res.redirect("/signin");
  }
}

function isInGroup(req, res, next) {
  console.log(`Checking group access for group: ${req.params.group}`);

  // In development mode, allow access to all groups
  if (config.developmentMode) {
    console.log("Development mode: Allowing access to all groups");
    return next();
  }

  if (Util.canAccessGroup(req.params.group, req)) {
    console.log(`User has access to group: ${req.params.group}`);
    return next();
  } else {
    console.log(`User does not have access to group: ${req.params.group}`);
    return next("you do not have permission to view this group");
  }
}
