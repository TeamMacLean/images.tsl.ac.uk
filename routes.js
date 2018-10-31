const express = require('express');
const router = express.Router();

const Auth = require('./controllers/auth');
const Groups = require('./controllers/groups');
const Projects = require('./controllers/projects');
const Admin = require('./controllers/admin');
const Experiments = require('./controllers/experiments');
const Captures = require('./controllers/captures');
const Samples = require('./controllers/samples');
// const config = require('./config');

/* GET home page. */
router
    .all(isAuthenticated)
    .get('/', function (req, res, next) {
        res.redirect('/groups');
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

// router.route('/admin')
//     .all([isAuthenticated, isAdmin])
//     .get(Admin.index);

router.route('/browse/:group/new')
    .all([isAuthenticated, isInGroup])
    .get(Projects.new)
    .post(Projects.newPost);
router.route('/browse/:group/:project')
    .all([isAuthenticated, isInGroup])
    .get(Projects.show);

router.route('/browse/:group/:project/new')
    .all([isAuthenticated, isInGroup])
    .get(Samples.new)
    .post(Samples.newPost);
router.route('/browse/:group/:project/:sample')
    .all([isAuthenticated, isInGroup])
    .get(Samples.show);

router.route('/browse/:group/:project/:sample/new')
    .all([isAuthenticated, isInGroup])
    .get(Experiments.new)
    .post(Experiments.newPost);
router.route('/browse/:group/:project/:sample/:experiment')
    .all([isAuthenticated, isInGroup])
    .get(Experiments.show);

router.route('/browse/:group/:project/:sample/:experiment/new')
    .all([isAuthenticated, isInGroup])
    .get(Captures.new);
router.route('/browse/:group/:project/:sample/:experiment/:capture')
    .all([isAuthenticated, isInGroup])
    .get(Captures.show);


module.exports = router;


function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        req.session.returnTo = req.path;
        return res.redirect('/signin');
    }
}

// function isAdmin(req, res, next) {
//     if (req.user && req.user.isAdmin) {
//         return next();
//     } else {
//         return res.status(401).send('Admins only.');
//     }
// }

function isInGroup(req, res, next) {

    return next();//TODO

}
