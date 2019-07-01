const Project = require('../models/project');
const Group = require('../models/group');
const renderError = require('../lib/renderError');
module.exports = {
    new: (req, res, next) => {
        console.log('wanted', req.url, 'got: NEW');

        const groupName = req.params.group;
        Group.find(groupName)
            .then(group => {
                if (group) {
                    delete group.projects;
                    return res.render('projects/new', {group: group});
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

                    if (req.body.id) {

                        Project.get(req.body.id)
                            .then(project => {

                                // project.update({
                                //     groupID: group.id,
                                //     name: projectName,
                                //     shortDescription: shortDescription,
                                //     longDescription: longDescription
                                // })

                                project.name = projectName;
                                project.shortDescription = shortDescription;
                                project.longDescription = longDescription;

                                project.save()
                                    .then(savedProject => {
                                        return res.redirect(`/browse/${groupName}/${savedProject.safeName}`)
                                    })
                                    .catch(err => renderError(res, err));

                            })
                            .catch(err => renderError(res, err))

                    } else {

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
                    }
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
        console.log('wanted', req.url, 'got: EDIT');

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