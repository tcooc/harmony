var request = require('request');

// DEPRECATED
function simpleGET(url) {
	return new Promise(function(resolve, reject) {
		request(url, function(error, response, body) {
			if(error || response.statusCode !== 200) {
				reject(error);
			} else {
				resolve(body);
			}
		});
	});
}

module.exports = {
	helpers: {
		simpleGET: simpleGET
	}
};
