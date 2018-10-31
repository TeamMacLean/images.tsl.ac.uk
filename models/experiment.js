const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');
const config = require('../config');

const Experiment = thinky.createModel('Experiment', {
    id: type.string(),
    sampleID: type.string().required(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),
    name: type.string().required(),
    safeName: type.string().required(),
});

module.exports = Experiment;

const Sample = require('./sample');
const Capture = require('./capture');

Experiment.pre('save', function (next) {
    const experiment = this;
    const GenerateSafeName = function () {
        return new Promise((good, bad) => {
            if (experiment.safeName) {
                return good();
            } else {
                Experiment.run()
                    .then(experiments => {
                        Util.generateSafeName(experiment.name, experiments)
                            .then(safeName => {
                                experiment.safeName = safeName;
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
            console.log('exp', experiment);
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

    GenerateSafeName()
        .then(MakeDirectory)
        .then(next)
        .catch(err => next(err));
});

Experiment.ensureIndex("createdAt");

Experiment.belongsTo(Sample, 'sample', 'sampleID', 'id');
Experiment.hasMany(Capture, 'captures', 'id', 'experimentID');