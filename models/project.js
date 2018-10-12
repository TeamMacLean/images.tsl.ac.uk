const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');
const config = require('../config');

const Project = thinky.createModel('Project', {
    id: type.string(),
    groupID: type.string().required(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),

    name: type.string().required()
});

module.exports = Project;

const Group = require('./group');
const Experiment = require('./experiment');

Project.pre('save', function (next) {
    const project = this;
    const GenerateSafeName = new Promise((good, bad) => {
        if (project.safeName) {
            return good();
        } else {
            Project.run()
                .then(projects => {
                    Util.generateSafeName(project.name, projects)
                        .then(saveName => {
                            project.safeName = saveName;
                            return good();
                        })
                })
                .catch(err => {
                    return bad(err);
                });
        }
    });

    const MakeDirectory = new Promise((good, bad) => {
        Group.get(project.groupID)
            .then(group => {
                Util.ensureDir(config.rootPath + '/' + group.safeName + '/' + project.safeName)
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
Project.ensureIndex("createdAt");

Project.belongsTo(Group, 'group', 'groupID', 'id');
Project.hasMany(Experiment, 'experiments', 'id', 'projectID');