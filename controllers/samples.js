const Project = require('../models/project');
const Sample = require('../models/sample');
const renderError = require('../lib/renderError');
module.exports = {

    new: (req, res, next) => {
        const projectName = req.params.project;
        const groupName = req.params.group;

        Project.filter({safeName: projectName})
            .getJoin({group: true})
            .run()
            .then(projects => {
                const projectsFiltered = projects.filter(p => p.group.safeName === groupName);
                if (projectsFiltered && projectsFiltered.length) {
                    return res.render('samples/edit', {project: projects[0]});
                } else {
                    return next();
                }
            });
    },
    save: (req, res, next) => {
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.body.name;
        const protocol = req.body.protocol;
        const taxID = req.body.taxID;
        const scientificName = req.body.scientificName;
        const commonName = req.body.commonName;


        Project.filter({safeName: projectName})
            .getJoin({group: true})
            .run()
            .then(projects => {
                const projectsFiltered = projects.filter(p => p.group.safeName === groupName);

                if (projectsFiltered && projectsFiltered.length) {

                    if (req.body.id) {
                        Sample.get(req.body.id)
                            .then(sample => {
                                sample.update({
                                    projectID: projectsFiltered[0].id,
                                    name: sampleName,
                                    protocol,
                                    taxID,
                                    scientificName,
                                    commonName
                                })
                                    .then(savedSample => {
                                        return res.redirect(`/browse/${groupName}/${projectName}/${savedSample.safeName}`)
                                    })
                                    .catch(err => renderError(res, err));
                            })
                    } else {


                        new Sample({
                            projectID: projectsFiltered[0].id,
                            name: sampleName,
                            protocol,
                            taxID,
                            scientificName,
                            commonName
                        })
                            .save()
                            .then(savedSample => {
                                return res.redirect(`/browse/${groupName}/${projectName}/${savedSample.safeName}`)
                            })
                            .catch(err => renderError(res, err));
                    }
                } else {
                    return next();
                }
            });


    },
    show: (req, res, next) => {
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.params.sample;

        Sample.find(groupName, projectName, sampleName)
            .then(sample => {
                return res.render('samples/show', {sample});
            })
            .catch(err => {
                return next(err);
            });

    },
    edit: (req, res, next) => {
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.params.sample;

        Sample.find(groupName, projectName, sampleName)
            .then(sample => {
                return res.render('samples/edit', {sample});
            })
            .catch(err => {
                return next();
            });

    }
};