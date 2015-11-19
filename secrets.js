var fs = require('fs');

var secretsFile = process.env['SECRETS'];
var secrets = JSON.parse(fs.readFileSync(secretsFile).toString());

module.exports = secrets;
