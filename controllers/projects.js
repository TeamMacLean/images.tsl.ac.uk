const Project = require('../models/project');
const Group = require('../models/group');
const renderError = require('../lib/renderError');
module.exports = {
    new: (req, res, next) => {

        const group = req.params.group;

        Group.filter({safeName: group})
            .run()
            .then(groups => {
                if (groups && groups.length) {
                    return res.render('projects/new', {group: groups[0]});
                } else {
                    renderError(res, new Error('Group does not exist'));
                }
            });


    },
    newPost: (req, res, next) => {
        const group = req.params.group;
        const projectName = req.body.name;


        Group.filter({safeName: group})
            .run()
            .then(groups => {
                if (groups && groups.length) {
                    const group = groups[0];
                    new Project({groupID: group.id, name: projectName})
                        .save()
                        .then(savedProject => {
                            return res.redirect(`/browse/${group.safeName}`)
                        })
                        .catch(err => renderError(res, err));
                } else {
                    renderError(res, new Error('Group does not exist'));
                }
            });

    }
    // show: (req, res, next) => {
    //
    //     const groupName = req.body.group;
    //
    //     Group.filter({safeName: groupName})
    //         .getJoin({projects:true})
    //         .then(groups => {
    //             if (groups && groups.length) {
    //                 return res.render('groups/show', {group: groups[0]});
    //             } else {
    //                 return renderError(res, new Error('Group not found'));
    //             }
    //         })
    //         .catch(err => {
    //             return renderError(res, err);
    //         });
    //
    // }
};