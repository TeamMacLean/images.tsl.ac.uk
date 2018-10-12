const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');
const config = require('../config');

const Experiment = thinky.createModel('Experiment', {
    id: type.string(),
    projectID: type.string().required(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),
    name: type.string().required(),
    safeName: type.string().required(),
});

module.exports = Experiment;

const Project = require('./project');
const File = require('./file');

Experiment.pre('save', function (next) {
    const experiment = this;


    const GenerateSafeName = new Promise((good, bad) => {
        if (experiment.safeName) {
            return good();
        } else {
            Experiment.run()
                .then(experiments => {
                    Util.generateSafeName(experiment.name, experiments)
                        .then(saveName => {
                            experiment.safeName = saveName;
                            return good();
                        })
                })
                .catch(err => {
                    return bad(err);
                });
        }
    });

    const MakeDirectory = new Promise((good, bad) => {
        Project.get(experiment.projectID)
            .getJoin({group: true})
            .then(project => {
                Util.ensureDir(config.rootPath + '/' + project.group.safeName + '/' + project.safeName + '/' + experiment.safeName)
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

    Promise.all([GenerateSafeName, MakeDirectory])
        .then(() => next())
        .catch(err => next(err));


});

Experiment.ensureIndex("createdAt");

Experiment.belongsTo(Project, 'project', 'projectID', 'id');
Experiment.hasMany(File, 'files', 'id', 'experimentID');