const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const sassMiddleware = require('node-sass-middleware');
const logger = require('morgan');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const config = require('./config');

const uploadFile = require('./lib/uploadFile');

const session = require('express-session');
const rethinkSession = require('session-rethinkdb')(session);

const tus = require('tus-node-server');
const tusServer = new tus.Server();
tusServer.datastore = new tus.FileStore({
    path: '/files'
});
tusServer.on(tus.EVENTS.EVENT_UPLOAD_COMPLETE, (event) => {
    uploadFile.create(event);
});

const router = require('./routes');
const Group = require('./models/group');
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());

app.all([config.tusPath, config.tusPath + '/*', config.tusPath + '/*.*'], tusServer.handle.bind(tusServer));

//TODO chche clear
app.use(function noCacheForRoot(req, res, next) {
    if (req.url === '/') {
        res.header("Cache-Control", "no-cache, no-store, must-revalidate");
        res.header("Pragma", "no-cache");
        res.header("Expires", 0);
    }
    next();
});

app.disable('view cache');



app.use(sassMiddleware({
    /* Options */
    src: path.join(__dirname, 'public', 'style'),
    dest: path.join(__dirname, 'public', 'style'),
    // debug: true,
    outputStyle: 'compressed',
    prefix: '/style/'  // Where prefix is at <link rel="stylesheets" href="prefix/style.css"/>
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/font-awesome', express.static('./node_modules/font-awesome'));

const r = require('./lib/thinky').r;
const store = new rethinkSession(r);
app.use(session({
    secret: config.secret,
    resave: false,
    saveUninitialized: false,
    store: store
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(function (req, res, next) {
    if (req.user != null) {
        res.locals.signedInUser = {};
        res.locals.signedInUser.username = req.user.username;
        res.locals.signedInUser.name = req.user.name;
        res.locals.signedInUser.mail = req.user.mail;

        if (config.admins.indexOf(req.user.username) > -1) {
            req.user.isAdmin = true;
            res.locals.signedInUser.isAdmin = true;
        }

        res.locals.config = {
            HPCRoot: config.HPCRoot
        };
    }
    next(null, req, res);
});

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

passport.use(new LdapStrategy({
    server: {
        url: config.ldap.url,
        bindDn: config.ldap.bindDn,
        bindCredentials: config.ldap.bindCredentials,
        searchBase: config.ldap.searchBase,
        searchFilter: config.ldap.searchFilter
    }
}, function (userLdap, done) {
    const user = {
        id: userLdap.sAMAccountName,
        username: userLdap.sAMAccountName,
        name: userLdap.name,
        mail: userLdap.mail,
        memberOf: userLdap.memberOf
    };

    done(null, user);
}));

//check group exists in DB
config.groups.map(group => {
    Group.filter({safeName: group.safeName})
        .run()
        .then(groups => {
            if (!(groups && groups.length)) {

                new Group({name: group.name, safeName: group.safeName})
                    .save()
                    .then(savedGroup => {
                        console.log('made new group', savedGroup.name);
                    })
                    .catch(err => {
                        console.error(err);
                    })
            }
        })
});

app.use('/', router);


module.exports = app;
