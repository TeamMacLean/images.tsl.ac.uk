const config = require('../config.js');
const thinky = require('thinky')({db: config.db});
module.exports = thinky;