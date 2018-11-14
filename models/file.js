const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const Util = require('../lib/util');
const config = require('../config');
const MD5 = require('md5.js');
const fs = require('fs');
const path = require('path');

const File = thinky.createModel('File', {
    id: type.string(),
    captureID: type.string().required(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),
    name: type.string().required(),
    originalName: type.string().required(),
    type: type.string().required(),
    description: type.string().default(''),
    MD5: type.string().required()
});

module.exports = File;

File.defineStatic('find', function (groupName, projectName, sampleName, experimentName, captureName, fileName) {
    return new Promise((good, bad) => {
        File.filter({name: fileName})
            .getJoin({
                capture: {experiment: {sample: {project: {group: true}}}, files: true}
            })
            .then(files => {
                const filesFiltered = files.filter(f => f.capture.experiment.sample.project.group.safeName === groupName
                    && f.capture.experiment.sample.project.safeName === projectName
                    && f.capture.experiment.sample.safeName === sampleName
                    && f.capture.experiment.safeName === experimentName
                    && f.capture.safeName === captureName
                );
                if (filesFiltered && filesFiltered.length) {
                    return good(filesFiltered[0]);
                } else {
                    return bad(new Error('File not found'));
                }
            })
            .catch(err => {
                return bad(err);
            });
    })
});

File.define('getPath', function () {
    const file = this;

    return new Promise((good, bad) => {
        Capture.get(file.captureID)
            .getJoin({experiment: {sample: {project: {group: true}}}})
            .then(capture => {
                return good(config.rootPath + '/' + capture.experiment.sample.project.group.safeName + '/' + capture.experiment.sample.project.safeName + '/' + capture.experiment.sample.safeName + '/' + capture.experiment.safeName + '/' + capture.safeName + '/' + file.name);
            })
            .catch(err => {
                return bad(err)
            })
    })
});

File.define('parsedName', function () {
    return path.parse(this.originalName).name;
});

const Capture = require('./capture');
File.pre('save', function (next) {
    const file = this;

    const oldPath = path.join(__dirname, '../', config.tusPath, file.name);

    //TODO make md5
    const buffer = fs.readFileSync(oldPath);
    const hash = new MD5();
    hash.end(buffer);
    file.MD5 = hash.read().toString('hex');

    file.getPath()
        .then(path => {
            //TODO move to new path

            Util.move(oldPath, path)
                .then(() => {
                    next()
                })
                .catch(err => {
                    console.error(err);
                    next(err);
                })
        })
        .catch(err => {
            next(err);
        });
});
//
File.ensureIndex("createdAt");

File.belongsTo(Capture, 'capture', 'captureID', 'id');