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
                    return res.render('samples/new', {project: projects[0]});
                } else {
                    return next();
                }
            });
    },
    newPost: (req, res, next) => {
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.body.name;

        Project.filter({safeName: projectName})
            .getJoin({group: true})
            .run()
            .then(projects => {
                const projectsFiltered = projects.filter(p => p.group.safeName === groupName);

                if (projectsFiltered && projectsFiltered.length) {
                    new Sample({projectID: projectsFiltered[0].id, name: sampleName})
                        .save()
                        .then(savedSample => {
                            return res.redirect(`/browse/${groupName}/${projectName}/${savedSample.safeName}`)
                        })
                        .catch(err => renderError(res, err));
                } else {
                    return next();
                }
            });


    },
    show: (req, res, next) => {
        const groupName = req.params.group;
        const projectName = req.params.project;
        const sampleName = req.params.sample;

        Sample.filter({safeName: sampleName})
            .getJoin({
                experiments: true,
                project: {group: true}
            })
            .then(samples => {
                const samplesFiltered = samples.filter(s => s.project.group.safeName === groupName
                    && s.project.safeName === projectName);
                if (samplesFiltered && samplesFiltered.length) {
                    return res.render('samples/show', {sample: samplesFiltered[0]});
                } else {
                    return next();
                }
            })
            .catch(err => {
                return next();
            });

    }
};