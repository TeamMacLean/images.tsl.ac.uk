const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const sassMiddleware = require("sass-middleware");
const logger = require("morgan");
const passport = require("passport");
const LdapStrategy = require("passport-ldapauth");
const config = require("./config");
const uploadFile = require("./lib/uploadFile");
const session = require("express-session");
const rethinkSession = require("session-rethinkdb")(session);
const tus = require("tus-node-server");
const tusServer = new tus.Server({ path: "/uploads" });

tusServer.datastore = new tus.FileStore({ directory: "./files" });
tusServer.on(tus.EVENTS.EVENT_UPLOAD_COMPLETE, (event) => {
  uploadFile.create(event);
  console.log("File upload complete:", event.file);
});

const router = require("./routes");
const Group = require("./models/group");
const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
// Don't advertise the framework.
app.disable("x-powered-by");
// The app runs behind an nginx reverse proxy in production; without this,
// req.secure is always false and HTTPS-only session cookies never get set.
// Set config.trustProxy to the number of proxies in front of Node if it is not
// exactly one, otherwise client IPs and req.secure will be wrong.
app.set("trust proxy", config.trustProxy === undefined ? 1 : config.trustProxy);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const uploadApp = express();
uploadApp.all("*", tusServer.handle.bind(tusServer));
app.use("/uploads", uploadApp);

app.use(function noCacheForRoot(req, res, next) {
  if (req.url === "/") {
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", 0);
    console.log("No-cache headers set for root URL");
  }
  next();
});

// Recompiling every template on every request is a development convenience;
// in production it is a needless cost on every page view.
if (config.developmentMode) {
  app.disable("view cache");
}

app.use(
  sassMiddleware({
    src: path.join(__dirname, "public", "style"),
    dest: path.join(__dirname, "public", "style"),
    outputStyle: "compressed",
    prefix: "/style/",
  }),
);

app.use(express.static(path.join(__dirname, "public")));
// Serve the Parcel-built JS files from public/js/dist under the /js/dist path
app.use(
  "/js/dist",
  express.static(path.join(__dirname, "public", "js", "dist")),
);
app.use("/font-awesome", express.static("./node_modules/font-awesome"));

const r = require("./lib/thinky").r;
const store = new rethinkSession(r);
app.use(
  session({
    secret: config.secret,
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
      httpOnly: true,
      // Blocks the session cookie from riding along on cross-site requests,
      // which is what makes the unprotected POST forms CSRF-able.
      sameSite: "lax",
      // "auto" marks the cookie Secure only when the connection actually is,
      // so this can't silently drop the cookie on a plain-HTTP deployment.
      // Relies on the `trust proxy` setting above to see through the nginx
      // TLS terminator.
      secure: "auto",
      // Deliberately no maxAge: this stays a browser-session cookie that dies
      // when the browser closes, as it always has.
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// After the session (it needs somewhere to keep the token) and before the
// router (every state-changing route is behind it).
app.use(require("./lib/csrf"));

app.use((req, res, next) => {
  // Only values that are safe to render into a page. Note supportEnabled is a
  // boolean: the webhook URL itself must never reach the browser.
  res.locals.config = {
    HPCRoot: config.HPCRoot,
    supportEnabled: !!config.supportWebhook,
  };

  if (req.user != null) {
    res.locals.signedInUser = {
      username: req.user.username,
      name: req.user.name,
      mail: req.user.mail,
      isAdmin: config.admins.indexOf(req.user.username) > -1,
    };
    req.user.isAdmin = res.locals.signedInUser.isAdmin;
    console.log("User signed in:", res.locals.signedInUser);
  }
  next();
});

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(
  new LdapStrategy(
    {
      server: {
        url: config.ldap.url,
        bindDn: config.ldap.bindDn,
        bindCredentials: config.ldap.bindCredentials,
        searchBase: config.ldap.searchBase,
        searchFilter: config.ldap.searchFilter,
      },
    },
    (userLdap, done) => {
      const user = {
        id: userLdap.sAMAccountName,
        username: userLdap.sAMAccountName,
        name: userLdap.name,
        mail: userLdap.mail,
        memberOf: userLdap.memberOf,
      };
      console.log("LDAP user authenticated:", user);
      done(null, user);
    },
  ),
);

config.groups.map((group) => {
  Group.filter({ safeName: group.safeName })
    .run()
    .then((groups) => {
      if (!(groups && groups.length)) {
        new Group({ name: group.name, safeName: group.safeName })
          .save()
          .then((savedGroup) => {
            console.log("Created new group:", savedGroup.name);
          })
          .catch((err) => {
            console.error("Error creating group:", err);
          });
      } else {
        //console.log("Group already exists:", group.safeName);
      }
    })
    // Without this, a database that is down at boot rejects here and the
    // unhandled rejection kills the process before it can serve anything.
    .catch((err) => {
      console.error("Error seeding group:", group.safeName, err);
    });
});

app.use(
  "/",
  (req, res, next) => {
    console.log("Received request for:", req.url);
    next();
  },
  router,
);

app.use((req, res) => {
  console.log("Rendering 404 for:", req.url);
  res.status(404).render("404");
});

// Express only treats a 4-argument middleware as an error handler. Without one,
// failures fall through to Express' default handler, which returns the raw
// stack trace to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`Error handling ${req.method} ${req.url}:`, err);

  if (res.headersSent) {
    return next(err);
  }

  const status = err && err.status ? err.status : 500;
  res.status(status);

  // Callback form: if the error page itself fails to render we still owe the
  // client a response rather than an open socket.
  res.render(
    "error",
    { error: err, showStack: !!config.developmentMode },
    (renderErr, html) => {
      if (renderErr) {
        console.error("Failed to render error page:", renderErr);
        return res.type("text").send("Internal Server Error");
      }
      res.send(html);
    },
  );
});

module.exports = app;
