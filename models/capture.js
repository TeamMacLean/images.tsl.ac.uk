const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');
const config = require('../config');

const fs = require('fs');

const Capture = thinky.createModel('Capture', {
    id: type.string(),
    experimentID: type.string().required(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),
    name: type.string().required(),
    safeName: type.string().required(),


    platformName: type.string().required(),
    // platformLens: type.string().required(),
    // platformCamera: type.string().required(),
    // platformGain: type.string().required()
    user:type.string()
});

module.exports = Capture;

Capture.defineStatic('find', function (groupName, projectName, sampleName, experimentName, captureName) {
    return new Promise((good, bad) => {
        Capture.filter({safeName: captureName})
            .getJoin({
                experiment: {sample: {project: {group: true}}}, files: true
            })
            .then(captures => {
                const capturessFiltered = captures.filter(c => c.experiment.sample.project.group.safeName === groupName
                    && c.experiment.sample.project.safeName === projectName
                    && c.experiment.sample.safeName === sampleName
                    && c.experiment.safeName === experimentName);
                if (capturessFiltered && capturessFiltered.length) {
                    return good(capturessFiltered[0]);
                } else {
                    return bad(new Error('Capture not found'));
                }
            })
            .catch(err => {
                return bad(err);
            });
    })
});

// const Sample = require('./sample');
const Experiment = require('./experiment');
const File = require('./file');

Capture.pre('save', function (next) {
    const capture = this;
    const OldSafeName = capture.safeName;

    const GenerateSafeName = function () {
        return new Promise((good, bad) => {
            Capture.run()
                .then(captures => {
                    captures = captures.filter(a => a.id !== capture.id);
                    Util.generateSafeName(capture.name, captures)
                        .then(safeName => {
                            capture.safeName = safeName;
                            return good();
                        })
                })
                .catch(err => {
                    return bad(err);
                });
        });
    };

    const MakeDirectory = function () {
        return new Promise((good, bad) => {
            Experiment.get(capture.experimentID)
                .getJoin({sample: {project: {group: true}}})
                .then(experiment => {
                    Util.ensureDir(`${config.rootPath}/${experiment.sample.project.group.safeName}/${experiment.sample.project.safeName}/${experiment.sample.safeName}/${experiment.safeName}/${capture.safeName}`)
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
            Experiment.get(capture.experimentID)
                .getJoin({sample: {project: {group: true}}})
                .then(experiment => {
                    const oldFullPath = `${config.rootPath}/${experiment.sample.project.group.safeName}/${experiment.sample.project.safeName}/${experiment.sample.safeName}/${experiment.safeName}/${oldName}`;
                    const newFullPath = `${config.rootPath}/${experiment.sample.project.group.safeName}/${experiment.sample.project.safeName}/${experiment.sample.safeName}/${experiment.safeName}/${newName}`;
                    fs.rename(oldFullPath, newFullPath, function (err) {
                        if (err) {
                            bad(err);
                        } else {
                            good()
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
        .then(() => {
            if (typeof OldSafeName !== 'undefined') {
                if (capture.safeName !== OldSafeName) {
                    return MoveDirectory(OldSafeName, capture.safeName)
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

Capture.ensureIndex("createdAt");

Capture.belongsTo(Experiment, 'experiment', 'experimentID', 'id');
Capture.hasMany(File, 'files', 'id', 'captureID');
