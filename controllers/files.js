const File = require('../models/file');
// const Capture = require('../models/capture');
// const Experiment = require('../models/experiment');
const renderError = require('../lib/renderError');
module.exports = {
    show: (req, res, next) => {
        const experimentName = req.params.experiment;
        const sampleName = req.params.sample;
        const projectName = req.params.project;
        const groupName = req.params.group;
        const captureName = req.params.capture;
        const fileName = req.params.file;
        File.find(groupName, projectName, sampleName, experimentName, captureName, fileName)
            .then(file => {
                return res.render('files/show', {file})
            })
            .catch(err => {
                return next();
            })


    },
    // Not implemented. Must still hand control on, otherwise the request hangs
    // until the client times out.
    edit: (req, res, next) => {
        return next();
    },
    download: (req, res, next) => {


        const experimentName = req.params.experiment;
        const sampleName = req.params.sample;
        const projectName = req.params.project;
        const groupName = req.params.group;
        const captureName = req.params.capture;
        const fileName = req.params.file;

        
        function downloadExperimental(fullPath, res) {
            res.setHeader("Content-Type", "application/octet-stream");
            return res.sendFile(fullPath);
         }
        
        File.find(groupName, projectName, sampleName, experimentName, captureName, fileName)
            .then(file => {
                file.getPath()
                    .then(filePath => {
                        //return downloadExperimental(filePath, res)
                        return res.download(filePath, file.originalName);
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
