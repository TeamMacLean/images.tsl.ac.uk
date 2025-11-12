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

app.disable("view cache");

app.use(
  sassMiddleware({
    src: path.join(__dirname, "public", "style"),
    dest: path.join(__dirname, "public", "style"),
    outputStyle: "compressed",
    prefix: "/style/",
  }),
);

app.use(express.static(path.join(__dirname, "public")));
app.use("/font-awesome", express.static("./node_modules/font-awesome"));

const r = require("./lib/thinky").r;
const store = new rethinkSession(r);
app.use(
  session({
    secret: config.secret,
    resave: false,
    saveUninitialized: false,
    store: store,
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  if (req.user != null) {
    res.locals.signedInUser = {
      username: req.user.username,
      name: req.user.name,
      mail: req.user.mail,
      isAdmin: config.admins.indexOf(req.user.username) > -1,
    };
    req.user.isAdmin = res.locals.signedInUser.isAdmin;
    res.locals.config = { HPCRoot: config.HPCRoot };
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
        console.log("Group already exists:", group.safeName);
      }
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

app.use((req, res, next) => {
  console.log(`Handling request: ${req.method} ${req.url}`);
  next();
});

app.use((req, res) => {
  console.log("Rendering 404 for:", req.url);
  res.status(404).send("Page not found");
});

module.exports = app;
