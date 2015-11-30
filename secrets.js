var fs = require('fs');

var secrets = JSON.parse(fs.readFileSync('.secrets').toString());

function check(key) {
	if(!secrets[key]) {
		throw new Error(key + ' not in secrets');
	}
}

check('logLevel');

check('owner');
check('email');
check('password');
check('prefix');

module.exports = secrets;
