var fs = require('fs');

var secretsFile = process.argv[2];
var secrets = JSON.parse(fs.readFileSync(secretsFile).toString());

module.exports = secrets;
