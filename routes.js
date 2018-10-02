const express = require('express');
const router = express.Router();

const Auth = require('./controllers/auth');
const Groups = require('./controllers/groups');
const Projects = require('./controllers/projects');
const Admin = require('./controllers/admin');
const config = require('./config');

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index');
});


router.route('/signin')
    .get(Auth.signIn)
    .post(Auth.signInPost);

router.route('/signout')
    .get(Auth.signOut);

router.route('/groups')
    .all(isAuthenticated)
    .get(Groups.index);

router.route('/browse/:group')
    .all([isAuthenticated, isInGroup])
    .get(Groups.show);

router.route('/admin')
    .all([isAuthenticated, isAdmin])
    .get(Admin.index);

router.route('/browse/:group/new')
    .all(isAuthenticated)
    .get(Projects.new)
    .post(Projects.newPost);


module.exports = router;


function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        req.session.returnTo = req.path;
        return res.redirect('/signin');
    }
}

function isAdmin(req, res, next) {
    if (req.user && req.user.isAdmin) {
        return next();
    } else {
        return res.status(401).send('Admins only.');
    }
}

function isInGroup(req, res, next) {

    return next();//TODO

}
