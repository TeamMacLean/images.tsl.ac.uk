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
                    return res.render('projects/edit', {group: groups[0]});
                } else {
                    next();
                }
            });


    },
    save: (req, res, next) => {
        const groupName = req.params.group;
        const projectName = req.body.name;

        const shortDescription = req.body['shortDescription'];
        const longDescription = req.body['longDescription'];


        Group.filter({safeName: groupName})
            .run()
            .then(groups => {
                if (groups && groups.length) {
                    const group = groups[0];
                    new Project({
                        groupID: group.id,
                        name: projectName,
                        shortDescription: shortDescription,
                        longDescription: longDescription
                    })
                        .save()
                        .then(savedProject => {
                            return res.redirect(`/browse/${groupName}/${savedProject.safeName}`)
                        })
                        .catch(err => renderError(res, err));
                } else {
                    next();
                    // renderError(res, new Error('Group does not exist'));
                }
            })
            .catch(err => {
                next(err);
            })

    },
    show: (req, res, next) => {

        const projectName = req.params.project;
        const groupName = req.params.group;

        Project.find(groupName, projectName)
            .then(project => {
                return res.render('projects/show', {project});
            })
            .catch(err => {
                return next();
            });

    },
    edit: (req, res, next) => {

        const projectName = req.params.project;
        const groupName = req.params.group;

        Project.find(groupName, projectName)
            .then(project => {
                return res.render('projects/edit', {project});
            })
            .catch(err => {
                return next();
            });

    }
};