const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');

const Experiment = thinky.createModel('Experiment', {
    id: type.string(),
    projectID: type.string().required(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),

    name: type.string().required(),
    safeName: type.string().required(),
});

module.exports = Experiment;

Experiment.pre('save', function (next) {
    const experiment = this;
    if (experiment.safeName) {
        return next();
    } else {
        Experiment.run()
            .then(experiments => {
                Util.generateSafeName(experiment.name, experiments)
                    .then(saveName => {
                        experiment.safeName = saveName;
                        return next();
                    })
            })
            .catch(err => {
                return next(err);
            });
    }
});

Experiment.ensureIndex("createdAt");

const Project = require('./project');
Experiment.belongsTo(Project, 'project', 'projectID', 'id');