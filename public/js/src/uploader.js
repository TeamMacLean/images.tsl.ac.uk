import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Tus from '@uppy/tus';
import ThumbnailGenerator from '@uppy/thumbnail-generator';
import Swal from 'sweetalert2'

const uploader = {
    init: function (inputSelector, captureID) {

        const uppy = Uppy({
            debug: true,
            autoProceed: false,
            meta: {
                captureID: captureID
            },
            restrictions: {
                maxFileSize: 200 * 1000 * 1000000,
                maxNumberOfFiles: 999,
                minNumberOfFiles: 1,
                allowedFileTypes: ['image/*', 'video/*', '.lif','.lifext']
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
            .use(Tus, {endpoint: '/uploads/'});

        uppy.on('complete', result => {
            console.log('successful files:', result.successful);
            console.log('failed files:', result.failed);

            const successfulFileNames = result.successful.map(s => {
                return s.name;
            }).join(', ');
            const failedFileNames = result.failed.map(s => {
                return s.name;
            }).join(', ');

            function displaySuccess() {

                Swal.fire({
                        title: 'Good job!',
                        text: successfulFileNames + ' successfully uploaded',
                        type: 'success',
                        onAfterClose: function () {
                            location.reload();
                        }
                    }
                )
            }

            function displayFailed() {
                Swal.fire({
                    type: 'error',
                    title: 'Oops...',
                    text: failedFileNames + ' failed to upload',
                    onAfterClose: function () {
                        if (result.successful.length) {
                            displaySuccess();
                        } else {
                            location.reload();
                        }
                    }
                })
            }

            if (result.failed.length) {
                displayFailed(); //calls success after if available
            } else {
                displaySuccess();
            }

        });
    }
};

window.uploader = uploader;
