const File = require('../models/file');
// const Capture = require('../models/capture');
// const Experiment = require('../models/experiment');
const renderError = require('../lib/renderError');
module.exports = {
    show:(req, res, next)=>{

    },
    edit:(req, res, next)=>{

    },
    download: (req, res, next) => {


        const experimentName = req.params.experiment;
        const sampleName = req.params.sample;
        const projectName = req.params.project;
        const groupName = req.params.group;
        const captureName = req.params.capture;
        const fileName = req.params.file;

        File.find(groupName, projectName, sampleName, experimentName, captureName, fileName)
            .then(file => {
                file.getPath()
                    .then(path => {
                        return res.sendFile(path);
                    })
                    .catch(err => {
                        next(err);
                    })
            })
            .catch(err => {
                return next();
            })


    }
};