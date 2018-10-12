const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const sassMiddleware = require('node-sass-middleware');
const logger = require('morgan');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');

const uploadFile = require('./lib/uploadFIle');

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
const config = require('./config');
const Group = require('./models/group');
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
// app.use(lessMiddleware(path.join(__dirname, 'public')));

app.all(['/files', '/files/*', '/files/*.*'], tusServer.handle.bind(tusServer));

app.use(sassMiddleware({
    /* Options */
    src: path.join(__dirname, 'public', 'style'),
    dest: path.join(__dirname, 'public', 'style'),
    // debug: true,
    outputStyle: 'compressed',
    prefix: '/style/'  // Where prefix is at <link rel="stylesheets" href="prefix/style.css"/>
}));

app.use(express.static(path.join(__dirname, 'public')));

// app.use('/fonts', express.static(__dirname + '/node_modules/font-awesome/fonts'));

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

        res.locals.config = {rootPath: config.rootPath};
    }
    next(null, req, res);
});

passport.serializeUser(function (user, done) {
    //console.log('serializeUser was called');
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    //console.log('deserializeUser was called');
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
    //if(userLdap.company === 'TSL'){ //TODO check company is TSL
    //}
    const user = {
        id: userLdap.sAMAccountName,
        username: userLdap.sAMAccountName,
        name: userLdap.name,
        mail: userLdap.mail,
        memberOf: userLdap.memberOf
    };

    done(null, user);
}));


//TODO check groups exist in the database

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

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
