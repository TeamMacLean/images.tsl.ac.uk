const File = require('../models/file');

module.exports = {

    create: function (event) {

        // Runs inside a tus event handler, where nothing catches a throw: a
        // single malformed upload would otherwise take the whole server down.
        try {
            const uploaded = event && event.file;
            if (!uploaded) {
                console.error('upload complete event carried no file');
                return;
            }

            const parsed = this._parseMetadataString(uploaded.upload_metadata);

            const name = uploaded.id;
            const originalName = parsed.filename && parsed.filename.decoded;
            const type = parsed.filetype && parsed.filetype.decoded;
            const captureID = parsed.captureID && parsed.captureID.decoded;
            const description = parsed.description ? parsed.description.decoded : null;

            if (name && originalName && type && captureID) {
                new File({
                    captureID,
                    name,
                    type,
                    originalName,
                    description
                })
                    .save()
                    .then(savedFile => {
                        console.log('saved', savedFile.name);
                    })
                    .catch(err => console.error('failed to save uploaded file', err));
            } else {
                console.error('incomplete upload metadata', {
                    name, originalName, type, captureID
                });
            }
        } catch (err) {
            console.error('failed to handle completed upload', err);
        }

    },

    /**
     * Parse a tus Upload-Metadata header into { key: {encoded, decoded} }.
     *
     * Tolerates absent, empty and malformed input so that a bad header is
     * reported as incomplete metadata by the caller rather than throwing.
     */
    _parseMetadataString(metadata_string) {
        if (typeof metadata_string !== 'string' || metadata_string === '') {
            return {};
        }

        return metadata_string.split(',').reduce((metadata, kv_pair) => {
            const [key, base64_value] = kv_pair.trim().split(' ');

            if (!key) {
                return metadata;
            }

            metadata[key] = {
                encoded: base64_value,
                // A valueless key is legal in the tus spec and decodes to "".
                // utf8 (not ascii) so non-English filenames survive the round trip.
                decoded: Buffer.from(base64_value || '', 'base64').toString('utf8'),
            };
            return metadata;
        }, {});
    }


};
