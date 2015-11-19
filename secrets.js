var fs = require('fs');

var secretsFile = process.env.HARMONY_SECRETS;
console.log('Loading secrets from ' + secretsFile);
var secrets = JSON.parse(fs.readFileSync(secretsFile).toString());

module.exports = secrets;
