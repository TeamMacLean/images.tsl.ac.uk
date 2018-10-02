const thinky = require('../lib/thinky');
const type = thinky.type;
const r = thinky.r;


const Group = thinky.createModel('Group', {
    id: type.string(),
    createdAt: type.date().default(r.now()),
    updatedAt: type.date(),

    name:type.string().required(),
    safeName:type.string().required(),

});

module.exports = Group;

Group.ensureIndex("createdAt");

const Project = require('./project');
Group.hasMany(Project, 'projects', 'id', 'groupID');