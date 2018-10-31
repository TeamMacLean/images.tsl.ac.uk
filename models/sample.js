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
    protocol: type.string()
});

module.exports = Sample;

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

    GenerateSafeName()
        .then(MakeDirectory)
        .then(next)
        .catch(err => next(err));

});
Sample.ensureIndex("createdAt");

Sample.belongsTo(Project, 'project', 'projectID', 'id');
Sample.hasMany(Experiment, 'experiments', 'id', 'sampleID');