const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;
const config = require('../config');
const Util = require('../lib/util');


const Group = thinky.createModel('Group', {
    id: type.string(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),
    name: type.string().required(),
    safeName: type.string().required(),

});

module.exports = Group;

Group.pre('save', function (next) {
    Util.ensureDir(config.rootPath + '/' + this.safeName)
        .then(() => {
            console.log('made',config.rootPath + '/' + this.safeName);
            next()
        })
        .catch(err => {
            console.error(err);
            next(err);
        })
});

Group.ensureIndex("createdAt");

const Project = require('./project');
Group.hasMany(Project, 'projects', 'id', 'groupID');