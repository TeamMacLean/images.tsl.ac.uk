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

        // Experiment.filter({safeName: experimentName})
        //     .getJoin({sample: {project: {group: true}}})
        //     .run()
            Experiment.find(groupName, projectName, sampleName, experimentName)
            .then(experiment => {
                // const experimentsFiltered = experiments.filter(e => e.sample.project.group.safeName === groupName
                //     && e.sample.safeName === sampleName
                //     && e.sample.project.safeName === projectName);

                if (experiment) {
                    return res.render('captures/edit', {experiment: experiment});
                } else {
                    next();
                }
            });
    },
    save: (req, res, next) => {
        console.log("SAVING");
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.params.sample;
        const experimentName = req.params.experiment;
        const captureName = req.body.name;

        const platformName = req.body.platformName;


        Experiment.find(groupName, projectName, sampleName, experimentName)
            .then(experiment => {

                if (req.body.id) {
                    Capture.get(req.body.id)
                        .then(capture => {
                            capture.name = captureName;
                            capture.platformName = platformName;
                            capture.save()
                                .then(savedCapture => {
                                    return res.redirect(`/browse/${groupName}/${projectName}/${sampleName}/${experimentName}/${savedCapture.safeName}`)
                                })
                                .catch(err => renderError(res, err));
                        })
                } else {
                    new Capture({
                        experimentID: experiment.id,
                        name: captureName,
                        platformName: platformName
                    })
                        .save()
                        .then(savedCapture => {
                            return res.redirect(`/browse/${groupName}/${projectName}/${sampleName}/${experimentName}/${savedCapture.safeName}`)
                        })
                        .catch(err => renderError(res, err));
                }


            })
            .catch(err => renderError(res, err));

    },
    show: (req, res, next) => {

        const experimentName = req.params.experiment;
        const sampleName = req.params.sample;
        const projectName = req.params.project;
        const groupName = req.params.group;
        const captureName = req.params.capture;

        Capture.find(groupName, projectName, sampleName, experimentName, captureName)
            .then(capture => {
                return res.render('captures/show', {capture: capture});
            })
            .catch(err => {
                console.error(err);
                return next();
            });
    },
    edit: (req, res, next) => {

        const experimentName = req.params.experiment;
        const sampleName = req.params.sample;
        const projectName = req.params.project;
        const groupName = req.params.group;
        const captureName = req.params.capture;

        Capture.find(groupName, projectName, sampleName, experimentName, captureName)
            .then(capture => {
                return res.render('captures/edit', {capture: capture});
            })
            .catch(err => {
                console.error(err);
                return next();
            });
    },
};