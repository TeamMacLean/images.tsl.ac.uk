const request = require('request');
const config = require('../config');

module.exports = {

    notify: (file) => {
        if (config.postChangesTo && config.postChangesTo.length) {
            file.getPath()
                .then(filePath => {
                    request.post(
                        config.postChangesTo,
                        {json: {params: filePath}},
                        function (error, response, body) {
                            if (error) {
                                console.error(error);
                            }
                            if (!error && response.statusCode == 200) {
                                console.log('posted changes to', config.postChangesTo);
                            }
                        }
                    );
                })
                .catch(err => {
                    console.error(err);
                })

        }
    }

};