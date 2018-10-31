const Sample = require('../models/sample');
// const Group = require('../models/group');
const Experiment = require('../models/experiment');
const renderError = require('../lib/renderError');
module.exports = {
    new: (req, res, next) => {

        const sampleName = req.params.sample;
        const projectName = req.params.project;
        const groupName = req.params.group;

        Sample.filter({safeName: sampleName})
            .getJoin({project: {group: true}})
            .run()
            .then(samples => {
                const samplesFiltered = samples.filter(p => p.project.group.safeName === groupName
                    && p.project.safeName === projectName);
                if (samplesFiltered && samplesFiltered.length) {
                    return res.render('experiments/new', {sample: samples[0]});
                } else {
                    return next();
                    // renderError(res, new Error('Project does not exist'));
                }
            });


    },
    newPost: (req, res, next) => {
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.params.sample;
        const experimentName = req.body.name;

        Sample.filter({safeName: sampleName})
            .getJoin({sample: {project: {group: true}}})
            .run()
            .then(samples => {
                const samplesFiltered = samples.filter((p => p.project.group.safeName === groupName
                    && p.project.safeName === projectName));

                if (samplesFiltered && samplesFiltered.length) {
                    new Experiment({sampleID: samplesFiltered[0].id, name: experimentName})
                        .save()
                        .then(savedExperiment => {
                            return res.redirect(`/browse/${groupName}/${projectName}/${sampleName}/${savedExperiment.safeName}`)
                        })
                        .catch(err => renderError(res, err));
                } else {
                    return next();
                }
            });
    },
    show: (req, res, next) => {

        const experimentName = req.params.experiment;
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.params.sample;

        Experiment.filter({safeName: experimentName})
            .getJoin({sample: {project: {group: true}, files: true}})
            .then(experiments => {
                const samplesExperiments = experiments.filter(e => e.sample.project.group.safeName === groupName
                    && e.sample.project.safeName === projectName
                    && e.sample.safeName === sampleName);

                if (samplesExperiments && samplesExperiments.length) {
                    return res.render('experiments/show', {experiment: samplesExperiments[0]});
                } else {
                    return next();
                }
            })
            .catch(err => {
                return next();
            });

    }
};