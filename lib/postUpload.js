const axios = require("axios");
const config = require("../config");

module.exports = {
  notify: (file) => {
    if (config.postChangesTo && config.postChangesTo.length) {
      file
        .getPath()
        .then((filePath) => {
          axios
            .post(config.postChangesTo, { params: filePath })
            .then((response) => {
              console.log("posted changes to", config.postChangesTo);
            })
            .catch((error) => {
              console.error(error);
            });
        })
        .catch((err) => {
          console.error(err);
        });
    }
  },
};
