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
                    return res.render('experiments/edit', {sample: samples[0]});
                } else {
                    return next();
                    // renderError(res, new Error('Project does not exist'));
                }
            });


    },
    save: (req, res, next) => {
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.params.sample;
        const experimentName = req.body.name;

        Sample.find(groupName, projectName, sampleName)
            .then(sample => {

                if (req.body.id) {

                    Experiment.get(req.body.id)
                        .then(experiment => {
                            experiment.update({
                                sampleID: sample.id, name: experimentName
                            })
                                .then(savedExperiment => {
                                    return res.redirect(`/browse/${groupName}/${projectName}/${sampleName}/${savedExperiment.safeName}`)
                                })
                                .catch(err => renderError(res, err));
                        })
                        .catch(err => renderError(res, err))

                } else {

                    new Experiment({sampleID: sample.id, name: experimentName})
                        .save()
                        .then(savedExperiment => {
                            return res.redirect(`/browse/${groupName}/${projectName}/${sampleName}/${savedExperiment.safeName}`)
                        })
                        .catch(err => renderError(res, err));
                }
            })
            .catch(err => renderError(res, err));

        // Sample.filter({safeName: sampleName})
        //     .getJoin({sample: {project: {group: true}}})
        //     .run()
        //     .then(samples => {
        //         const samplesFiltered = samples.filter((p => p.project.group.safeName === groupName
        //             && p.project.safeName === projectName));
        //
        //         if (samplesFiltered && samplesFiltered.length) {
        //             new Experiment({sampleID: samplesFiltered[0].id, name: experimentName})
        //                 .save()
        //                 .then(savedExperiment => {
        //                     return res.redirect(`/browse/${groupName}/${projectName}/${sampleName}/${savedExperiment.safeName}`)
        //                 })
        //                 .catch(err => renderError(res, err));
        //         } else {
        //             return next();
        //         }
        //     });
    },
    show: (req, res, next) => {

        const experimentName = req.params.experiment;
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.params.sample;

        Experiment.find(groupName, projectName, sampleName, experimentName)
            .then(experiment => {
                return res.render('experiments/show', {experiment});
            })
            .catch(err => {
                return next();
            });

    },
    edit: (req, res, next) => {

        const experimentName = req.params.experiment;
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.params.sample;

        Experiment.find(groupName, projectName, sampleName, experimentName)
            .then(experiment => {
                return res.render('experiments/edit', {experiment});
            })
            .catch(err => {
                return next();
            });

    }
};