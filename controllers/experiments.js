const Project = require('../models/project');
// const Group = require('../models/group');
const Experiment = require('../models/experiment');
const renderError = require('../lib/renderError');
module.exports = {
    new: (req, res, next) => {

        const projectName = req.params.project;
        const groupName = req.params.group;

        Project.filter({safeName: projectName})
            .getJoin({group: true})
            .run()
            .then(projects => {
                const projectsFiltered = projects.filter(p => p.group.safeName === groupName);
                if (projectsFiltered && projectsFiltered.length) {
                    return res.render('experiments/new', {project: projects[0]});
                } else {
                    next();
                    // renderError(res, new Error('Project does not exist'));
                }
            });


    },
    newPost: (req, res, next) => {
        const groupName = req.params.group;
        const projectName = req.params.project;
        const experimentName = req.body.name;

        Project.filter({safeName: projectName})
            .getJoin({group: true})
            .run()
            .then(projects => {
                const projectsFiltered = projects.filter(p => p.group.safeName === groupName);

                if (projectsFiltered && projectsFiltered.length) {
                    new Experiment({projectID: projectsFiltered[0].id, name: experimentName})
                        .save()
                        .then(savedExperiment => {
                            return res.redirect(`/browse/${projectsFiltered[0].safeName}/${projectsFiltered[0].safeName}/${savedExperiment.safeName}`)
                        })
                        .catch(err => renderError(res, err));
                } else {
                    next();
                    // renderError(res, new Error('Project does not exist'));
                }
            });

        // Group.filter({safeName: groupName})
        //     .getJoin({projects: true})
        //     .run()
        //     .then(groups => {
        //         if (groups && groups.length) {
        //             const group = groups[0];
        //
        //             const projects = group.projects.filter(p => p.safeName === projectName);
        //             if (projects && projects.length) {
        //                 new Experiment({projectID: projects[0].id, name: experimentName})
        //                     .save()
        //                     .then(savedExperiment => {
        //                         return res.redirect(`/browse/${group.safeName}/${projects[0].safeName}/${savedExperiment.safeName}`)
        //                     })
        //                     .catch(err => renderError(res, err));
        //             } else {
        //
        //             }
        //
        //
        //         } else {
        //             renderError(res, new Error('Group does not exist'));
        //         }
        //     });

    },
    show: (req, res, next) => {

        const experimentName = req.params.experiment;

        Experiment.filter({safeName: experimentName})
            .getJoin({project: {group: true}, files: true})
            .then(experiments => {
                if (experiments && experiments.length) {
                    return res.render('experiments/show', {experiment: experiments[0]});
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