const Group = require('../models/group');
const config = require('../config');
const renderError = require('../lib/renderError');
const Util = require('../lib/util');
module.exports = {
    index: (req, res, next) => {
        Group.run()
            .then(groups => {

                //TODO if they cannot access the group, mark it as disabled


                groups = groups.map(g => {
                    const configGroup = config.groups.filter(cf => {
                        return cf.safeName === g.safeName;
                    });
                    if (configGroup && configGroup.length && configGroup[0].image) {
                        g.image = configGroup[0].image;
                    }

                    if (!Util.canAccessGroup(g.safeName, req)) {
                        g.disabled = true;
                    }

                    return g;
                });
                return res.render('groups/index', {groups});
            })
            .catch(err => {
                renderError(err);
            });
    },
    show: (req, res, next) => {
        const groupName = req.params.group;
        Group.find(groupName)
            .then(group => {
                return res.render('groups/show', {group});
            })
            .catch(err => {
                return next();
            });
    }
};