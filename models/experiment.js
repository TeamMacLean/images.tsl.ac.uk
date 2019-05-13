const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');
const config = require('../config');

const fs = require('fs');

const Experiment = thinky.createModel('Experiment', {
    id: type.string(),
    sampleID: type.string().required(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),
    name: type.string().required(),
    safeName: type.string().required(),
});

module.exports = Experiment;

Experiment.defineStatic('find', function (groupName, projectName, sampleName, experimentName) {
    return new Promise((good, bad) => {
        Experiment.filter({safeName: experimentName})
            .getJoin({sample: {project: {group: true}, files: true}, captures: true})
            .then(experiments => {
                const samplesExperiments = experiments.filter(e => e.sample.project.group.safeName === groupName
                    && e.sample.project.safeName === projectName
                    && e.sample.safeName === sampleName);

                if (samplesExperiments && samplesExperiments.length) {
                    return good(samplesExperiments[0]);
                } else {
                    return bad(new Error('Experiment not found'));
                }
            })
            .catch(err => {
                return bad(err);
            });
    })
});

const Sample = require('./sample');
const Capture = require('./capture');

Experiment.pre('save', function (next) {
    const experiment = this;
    const OldSafeName = experiment.safeName;

    const GenerateSafeName = function () {
        return new Promise((good, bad) => {
            Experiment.run()
                .then(experiments => {
                    experiments = experiments.filter(a => a.id !== experiment.id);
                    Util.generateSafeName(experiment.name, experiments)
                        .then(safeName => {
                            experiment.safeName = safeName;
                            return good(safeName);
                        })
                })
                .catch(err => {
                    return bad(err);
                });
            // }
        });
    };

    const MakeDirectory = function () {
        return new Promise((good, bad) => {
            Sample.get(experiment.sampleID)
                .getJoin({project: {group: true}})
                .then(sample => {
                    Util.ensureDir(`${config.rootPath}/${sample.project.group.safeName}/${sample.project.safeName}/${sample.safeName}/${experiment.safeName}`)
                        .then(() => {
                            good()
                        })
                        .catch(err => {
                            console.error(err);
                            bad(err);
                        })
                })
                .catch(err => {
                    console.error(err);
                    bad(err);
                })
        });
    };

    const MoveDirectory = function (oldName, newName) {
        return new Promise((good, bad) => {
            Sample.get(experiment.sampleID)
                .getJoin({project: {group: true}})
                .then(sample => {
                    const oldFullPath = `${config.rootPath}/${sample.project.group.safeName}/${sample.project.safeName}/${sample.safeName}/${oldName}`;
                    const newFullPath = `${config.rootPath}/${sample.project.group.safeName}/${sample.project.safeName}/${sample.safeName}/${newName}`;
                    fs.rename(oldFullPath, newFullPath, function (err) {
                        if (err) {
                            bad(err);
                        } else {
                            good(newName)
                        }

                    })
                })
                .catch(err => {
                    console.error(err);
                    bad(err);
                })
        })
    };

    GenerateSafeName()
        .then(newSafeName => {
            if (typeof OldSafeName !== 'undefined') {
                if (experiment.safeName !== OldSafeName) {
                    return MoveDirectory(experiment.safeName, newSafeName)
                } else {
                    next();
                }
            } else {
                return MakeDirectory()
            }
        })
        .then(function () {
            return next();
        })
        .catch(err => next(err));
});

Experiment.ensureIndex("createdAt");

Experiment.belongsTo(Sample, 'sample', 'sampleID', 'id');
Experiment.hasMany(Capture, 'captures', 'id', 'experimentID');