const Group = require('../models/group');
const config = require('../config');
const renderError = require('../lib/renderError');
const Util = require('../lib/util');
module.exports = {
    index: (req, res, next) => {
        Group.run()
            .then(groups => {

                //TODO if they cannot access the group, mark it as disabled

                // console.log('groups', groups);
                // console.log('config', config);

                groups = groups.map(g => {

                    const result = {};
                    //console.log('objectkeys', Object.keys(g));
                    Object.keys(g).forEach(key => {
                        result[key] = g[key]
                    })
                    // console.log('typeof new object', typeof(result));

                    const configGroup = config.groups.filter(cf => {
                        // console.log('safename cf.', result.safeName, cf.safeName);
                        
                        return cf.safeName === result.safeName;
                    });
                    // console.log('configGroup', configGroup);
                    
                    if (configGroup && configGroup.length && configGroup[0].image) {
                        // console.log('configGroup[0].image', configGroup[0].image)
                        result.image = configGroup[0].image;
                    }

                    if (!!Util && !!(Util.canAccessGroup) && !Util.canAccessGroup(result.safeName, req)) {
                        result.disabled = true;
                    }

                    if (result.safeName && (result.safeName === 'maw')){
                        // console.log('reset image for maw group');
                        
                        result.image = '/img/groups/maw.jpg';
                    }

                    // console.log('after', result);
                    
                    return result;
                });
                // console.log('i have reached res.render groups/index');
                
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