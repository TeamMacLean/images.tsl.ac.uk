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
                    return res.render('captures/new', {experiment: experimentsFiltered[0]});
                } else {
                    next();
                }
            });
    },
    newPost: (req, res, next) => {
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

        Capture.filter({safeName: captureName})
            .getJoin({experiment: {sample: {project: {group: true}, files: true}}})
            .then(captures => {
                const capturessFiltered = captures.filter(c => c.experiment.sample.project.group.safeName === groupName
                    && c.experiment.sample.project.safeName === projectName
                    && c.experiment.sample.safeName === sampleName
                    && c.experiment.safeName === experimentName);
                if (capturessFiltered && capturessFiltered.length) {
                    return res.render('captures/show', {capture: capturessFiltered[0]});
                } else {
                    return next();
                }
            })
            .catch(err => {
                return next();
            });

    }
};