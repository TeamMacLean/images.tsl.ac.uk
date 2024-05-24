// ./lib/thinky.js
const config = require("../config");

const thinky = require("thinky")({
  host: config.rethinkdb.host || "localhost", // use config value or default to 'localhost'
  port: config.rethinkdb.port || 28015, // use config value or default to 28015
  db: config.rethinkdb.db || "imagehog", // use config value or default to 'imagehog'
});

module.exports = thinky;
