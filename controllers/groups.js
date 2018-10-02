const Group = require('../models/group');
const config = require('../config');
const renderError = require('../lib/renderError');
module.exports = {
    index: (req, res, next) => {
        Group.run()
            .then(groups => {

                groups = groups.map(g => {

                    const configGroup = config.groups.filter(cf => {
                        return cf.safeName === g.safeName;
                    });


                    if (configGroup && configGroup.length && configGroup[0].image) {
                        g.image = configGroup[0].image;
                    }

                    // console.log(g);
                    return g;

                });

                return res.render('groups/index', {groups});
            })
            .catch(err => {
                renderError(err);
            });

    },
    show: (req, res, next) => {

        const groupName = req.body.group;

        Group.filter({safeName: groupName})
            .getJoin({projects: true})
            .then(groups => {
                if (groups && groups.length) {
                    return res.render('groups/show', {group: groups[0]});
                } else {
                    return renderError(res, new Error('Group not found'));
                }
            })
            .catch(err => {
                return renderError(res, err);
            });

    }
};