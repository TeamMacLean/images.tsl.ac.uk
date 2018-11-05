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
    shortDescription: type.string().required(),
    longDescription: type.string().required(),
    name: type.string().required()
});

module.exports = Project;

Project.defineStatic('find', function (groupName, projectName) {
    return new Promise((good, bad) => {
        Project.filter({safeName: projectName})
            .getJoin({group: true, samples: true})
            .then(projects => {
                const filteredProjects = projects.filter(p => p.group.safeName === groupName);
                if (filteredProjects && filteredProjects.length) {
                    return good(filteredProjects[0]);
                } else {
                    bad(new Error('Project not found'));
                }
            })
            .catch(err => {
                bad(err);
            });
    })
});


const Group = require('./group');
const Sample = require('./sample');

Project.pre('save', function (next) {
    const project = this;
    const GenerateSafeName = function () {
        return new Promise((good, bad) => {
            if (project.safeName) {
                return good();
            } else {
                Project.run()
                    .then(projects => {
                        Util.generateSafeName(project.name, projects)
                            .then(safeName => {
                                project.safeName = safeName;
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
    };

    GenerateSafeName()
        .then(MakeDirectory)
        .then(next)
        .catch(err => next(err));

});
Project.ensureIndex("createdAt");

Project.belongsTo(Group, 'group', 'groupID', 'id');
Project.hasMany(Sample, 'samples', 'id', 'projectID');