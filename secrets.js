var fs = require('fs');

var secrets = JSON.parse(fs.readFileSync('.secrets').toString());

module.exports = secrets;
