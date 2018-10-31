const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');
const config = require('../config');

const File = thinky.createModel('File', {
    id: type.string(),
    experimentID: type.string().required(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),
    name: type.string().required(),
    originalName: type.string().required(),
    type: type.string().required(),
    description: type.string().default(''),
    MD5: type.string().required()
});

module.exports = File;

// const Experiment = require('./experiment');
//
// File.define('parsedName', function () {
//     console.log(this.originalName.split('.')[0]);
//     return this.originalName.split('.')[0];
// });
//
//
// File.pre('save', function (next) {
//     const file = this;
//     Experiment.get(file.experimentID)
//         .getJoin({project: {group: true}})
//         .then(experiment => {
//             const oldPath = config.uploadTempDir + '/' + file.name;
//             const newPath = config.rootPath + '/' + experiment.project.group.safeName + '/' + experiment.project.safeName + '/' + experiment.safeName + '/' + file.name;
//             Util.move(oldPath, newPath)
//                 .then(() => {
//                     next()
//                 })
//                 .catch(err => {
//                     console.error(err);
//                     next(err);
//                 })
//         })
//         .catch(err => {
//             console.error(err);
//             next(err);
//         })
// });
//
// File.ensureIndex("createdAt");
//
// File.belongsTo(Experiment, 'experiment', 'experimentID', 'id');