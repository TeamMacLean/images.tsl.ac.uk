const Project = require('../models/project');
const Group = require('../models/group');
const renderError = require('../lib/renderError');
module.exports = {
    new: (req, res, next) => {

        const groupName = req.params.group;

        Group.filter({safeName: groupName})
            .run()
            .then(groups => {
                if (groups && groups.length) {
                    return res.render('projects/new', {group: groups[0]});
                } else {
                    next();
                    // renderError(res, new Error('Group does not exist'));
                }
            });


    },
    newPost: (req, res, next) => {
        const groupName = req.params.group;
        const projectName = req.body.name;


        Group.filter({safeName: groupName})
            .run()
            .then(groups => {
                if (groups && groups.length) {
                    const group = groups[0];
                    new Project({groupID: group.id, name: projectName})
                        .save()
                        .then(savedProject => {
                            return res.redirect(`/browse/${group.safeName}`)
                        })
                        .catch(err => renderError(res, err));
                } else {
                    next();
                    // renderError(res, new Error('Group does not exist'));
                }
            })
            .catch(err=>{
                next();
            })

    },
    show: (req, res, next) => {

        const projectName = req.params.project;

        Project.filter({safeName: projectName})
            .getJoin({group: true, experiments: true})
            .then(projects => {
                if (projects && projects.length) {
                    return res.render('projects/show', {project: projects[0]});
                } else {
                    next();
                    // return renderError(res, new Error('Group not found'));
                }
            })
            .catch(err => {
                next();
                // return renderError(res, err);
            });

    }
};