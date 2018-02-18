const url = require('url');
const spawn = require('child_process').spawn;
const logger = require('logger');

module.exports = function(messaging) {
	messaging.addCommandHandler(/^!mcstatus/i, function(message, content) {
		if(content.length < 2) {
			messaging.send(message, 'Please specify a server');
		} else {
			var urlObj = url.parse('minecraft://' + content[1]), cla = urlObj.host;
			if(cla) {
				if(urlObj.port) {
					cla += ':' + urlObj.port;
				}
				mcstatus(cla).then(function(result) {
					messaging.send(message, result);
				}).catch(function(err) {
					logger.debug(err);
					messaging.send(message, 'No online server found');
				});
				messaging.send(message, '');
			} else {
				messaging.send(message, 'Invalid server');
			}
		}
		return true;
	});

};

function mcstatus(arg) {
	return new Promise(function(resolve, reject) {
		const child = spawn('/usr/local/bin/mcstatus', [arg, 'status']);
		var out = '';
		var err = '';
		child.stdout.on('data', (data) => {
			out += data;
		});
		child.stderr.on('data', (data) => {
			err += data;
		});
		child.on('close', (code) => {
			if(code === 0) {
				resolve(out);
			} else {
				reject(err);
			}
		});
	});
}
