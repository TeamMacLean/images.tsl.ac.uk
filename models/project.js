const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');

const Project = thinky.createModel('Project', {
    id: type.string(),
    groupID: type.string().required(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),

    name: type.string().required()
});

module.exports = Project;

Project.pre('save', function (next) {
    const project = this;
    if (project.safeName) {
        return next();
    } else {
        Project.run()
            .then(projects => {
                Util.generateSafeName(project.name, projects)
                    .then(saveName => {
                        project.safeName = saveName;
                        return next();
                    })
            })
            .catch(err => {
                return next(err);
            });
    }
});

Project.ensureIndex("createdAt");

const Group = require('./group');
const Experiment = require('./experiment');
Project.belongsTo(Group, 'group', 'groupID', 'id');
Project.hasMany(Experiment, 'experiments', 'id', 'projectID');