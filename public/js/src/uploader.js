import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Tus from '@uppy/tus';
import ThumbnailGenerator from '@uppy/thumbnail-generator';

const uploader = {
    init: function (inputSelector, captureID) {

        const uppy = Uppy({
            debug: true,
            autoProceed: false,
            meta: {
                captureID: captureID
            },
            restrictions: {
                maxFileSize: 20000 * 1000000,
                maxNumberOfFiles: 999,
                minNumberOfFiles: 1,
                allowedFileTypes: ['image/*', 'video/*']
            }
        })
            .use(ThumbnailGenerator, {
                thumbnailWidth: 200
            })
            .use(Dashboard, {
                proudlyDisplayPoweredByUppy: false,
                // // inline: true,
                trigger: '#uppy-trigger',
                // // target: inputSelector,
                // // replaceTargetContent: true,
                showProgressDetails: true,
                // height: 470,
                metaFields: [
                    {id: 'name', name: 'Name', placeholder: 'file name'},
                    {id: 'description', name: 'Description', placeholder: 'describe what the image/video'},
                ],
                // browserBackButtonClose: true
            })
            .use(Tus, {endpoint: '/files/'});

        uppy.on('complete', result => {
            console.log('successful files:', result.successful);
            console.log('failed files:', result.failed);

            //TODO notify of success
            //TODO notify of error

            //TODO don't reload until user confirms notification

            location.reload();
        });
    }
};

window.uploader = uploader;