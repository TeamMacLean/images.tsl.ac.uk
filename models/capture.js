const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');
const config = require('../config');

const Capture = thinky.createModel('Capture', {
    id: type.string(),
    experimentID: type.string().required(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),
    name: type.string().required(),
    safeName: type.string().required(),


    platformName: type.string().required(),
    platformLens: type.string().required(),
    platformCamera: type.string().required(),
    platformGain: type.string().required()
});

module.exports = Capture;

const Sample = require('./sample');
const Experiment = require('./experiment');
const File = require('./file');

Capture.pre('save', function (next) {
    const capture = this;
    const GenerateSafeName = function () {
        return new Promise((good, bad) => {
            if (capture.safeName) {
                return good();
            } else {
                Capture.run()
                    .then(captures => {
                        Util.generateSafeName(capture.name, captures)
                            .then(safeName => {
                                capture.safeName = safeName;
                                return good();
                            })
                    })
                    .catch(err => {
                        return bad(err);
                    });
            }
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

    GenerateSafeName()
        .then(MakeDirectory)
        .then(next)
        .catch(err => next(err));

});

Capture.ensureIndex("createdAt");

Capture.belongsTo(Sample, 'sample', 'sampleID', 'id');
Capture.hasMany(File, 'files', 'id', 'captureID');