const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');
const config = require('../config');

const fs = require('fs');

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
    const OldSafeName = project.safeName;

    const GenerateSafeName = function () {
        return new Promise((good, bad) => {
            if (project.safeName) {
                return good();
            } else {
                Project.run()
                    .then(projects => {
                        projects = projects.filter(a => a.id !== project.id);
                        Util.generateSafeName(project.name, projects)
                            .then(safeName => {
                                project.safeName = safeName;
                                return good(safeName);
                            })
                    })
                    .catch(err => {
                        return bad(err);
                    });
            }
        });
    };

    const MoveDirectory = function (oldName, newName) {
        return new Promise((good, bad) => {
            Group.get(project.groupID)
                .then(group => {
                    const oldFullPath = `${config.rootPath}/${group.safeName}/${oldName}`;
                    const newFullPath = `${config.rootPath}/${group.safeName}/${newName}`;
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

    const MakeDirectory = function (newName) {
        return new Promise((good, bad) => {
            Group.get(project.groupID)
                .then(group => {
                    Util.ensureDir(`${config.rootPath}/${group.safeName}/${project.safeName}`)
                        .then(() => {
                            good(newName)
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

    const self = this;
    GenerateSafeName()
        .then(() => {
            console.log(OldSafeName, safeName);
            if (OldSafeName) {
                if (self.safeName !== OldSafeName) {

                    //move
                    return MoveDirectory(OldSafeName, this.safeName)
                } else {
                    next();
                }
            } else {
                return MakeDirectory(this.safeName)
            }
        })
        .then(next)
        .catch(err => next(err));
});
Project.ensureIndex("createdAt");

Project.belongsTo(Group, 'group', 'groupID', 'id');
Project.hasMany(Sample, 'samples', 'id', 'projectID');