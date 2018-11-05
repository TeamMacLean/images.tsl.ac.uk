const Project = require('../models/project');
const Capture = require('../models/capture');
const Experiment = require('../models/experiment');
const renderError = require('../lib/renderError');
module.exports = {
    new: (req, res, next) => {

        const experimentName = req.params.experiment;
        const sampleName = req.params.sample;
        const projectName = req.params.project;
        const groupName = req.params.group;

        Experiment.filter({safeName: experimentName})
            .getJoin({sample: {project: {group: true}}})
            .run()
            .then(experiments => {
                const experimentsFiltered = experiments.filter(e => e.sample.project.group.safeName === groupName
                    && e.sample.safeName === sampleName
                    && e.sample.project.safeName === projectName);

                if (experimentsFiltered && experimentsFiltered.length) {
                    return res.render('captures/edit', {experiment: experimentsFiltered[0]});
                } else {
                    next();
                }
            });
    },
    save: (req, res, next) => {
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.params.sample;
        const experimentName = req.body.name;

        Project.filter({safeName: projectName})
            .getJoin({group: true})
            .run()
            .then(projects => {
                const projectsFiltered = projects.filter(p => p.group.safeName === groupName
                    && p.sample.safeName === sampleName);

                if (projectsFiltered && projectsFiltered.length) {
                    new Experiment({projectID: projectsFiltered[0].id, name: experimentName})
                        .save()
                        .then(savedExperiment => {
                            return res.redirect(`/browse/${groupName}/${projectName}/${sampleName}/${savedExperiment.safeName}/`)
                        })
                        .catch(err => renderError(res, err));
                } else {
                    return next();
                }
            });
    },
    show: (req, res, next) => {

        const experimentName = req.params.experiment;
        const sampleName = req.params.sample;
        const projectName = req.params.project;
        const groupName = req.params.group;
        const captureName = req.params.capture;

        Capture.find(captureName, experimentName, sampleName, projectName, groupName)
            .then(capture => {
                return res.render('captures/show', {capture: capture});
            })
            .catch(err => {
                return next();
            });
    },
    edit: (req, res, next) => {

        const experimentName = req.params.experiment;
        const sampleName = req.params.sample;
        const projectName = req.params.project;
        const groupName = req.params.group;
        const captureName = req.params.capture;

        Capture.find(captureName, experimentName, sampleName, projectName, groupName)
            .then(capture => {
                return res.render('captures/edit', {capture: capture});
            })
            .catch(err => {
                return next();
            });
    },
};