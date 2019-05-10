const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');
const config = require('../config');

const Sample = thinky.createModel('Sample', {
    id: type.string(),
    projectID: type.string().required(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),
    name: type.string().required(),
    protocol: type.string().required(),
    taxID: type.string().required(),
    scientificName: type.string().required(),
    commonName: type.string().required()
});

module.exports = Sample;

Sample.defineStatic('find', function (groupName, projectName, sampleName) {
    return new Promise((good, bad) => {

        Sample.filter({safeName: sampleName})
            .getJoin({
                experiments: true,
                project: {group: true}
            })
            .then(samples => {
                const samplesFiltered = samples.filter(s => s.project.group.safeName === groupName
                    && s.project.safeName === projectName);
                if (samplesFiltered && samplesFiltered.length) {
                    return good(samplesFiltered[0]);
                } else {
                    return bad(new Error('Sample not found'));
                }
            })
            .catch(err => {
                return bad(err);
            });

    })
});

const Project = require('./project');
const Experiment = require('./experiment');

Sample.pre('save', function (next) {
    const sample = this;
    const GenerateSafeName = function () {
        return new Promise((good, bad) => {
            if (sample.safeName) {
                return good();
            } else {
                Sample.run()
                    .then(samples => {
                        Util.generateSafeName(sample.name, samples)
                            .then(safeName => {
                                sample.safeName = safeName;
                                return good();
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
            Project.get(sample.projectID)
                .getJoin({group: true})
                .then(project => {
                    const oldFullPath = `${config.rootPath}/${project.group.safeName}/${project.safeName}/${oldName}`;
                    const newFullPath = `${config.rootPath}/${project.group.safeName}/${project.safeName}/${newName}`;
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

    const MakeDirectory = function () {
        return new Promise((good, bad) => {

            Project.get(sample.projectID)
                .getJoin({group: true})
                .then(project => {
                    Util.ensureDir(`${config.rootPath}/${project.group.safeName}/${project.safeName}/${sample.safeName}`)
                        .then(() => {
                            return good()
                        })
                        .catch(err => {
                            console.error(err);
                            return bad(err);
                        })
                })
                .catch(err => {
                    console.error(err);
                    return bad(err);
                })
        });
    };

    // GenerateSafeName()
    //     .then(MakeDirectory)
    //     .then(next)
    //     .catch(err => next(err));

    const self = this;
    GenerateSafeName()
        .then(newSafeName => {
            if (self.safeName) {
                if (self.safeName !== newSafeName) {
                    //move
                    return MoveDirectory(self.safeName, newSafeName)
                }
            } else {
                return MakeDirectory()
            }
        })
        .then(next)
        .catch(err => next(err));

});
Sample.ensureIndex("createdAt");

Sample.belongsTo(Project, 'project', 'projectID', 'id');
Sample.hasMany(Experiment, 'experiments', 'id', 'sampleID');