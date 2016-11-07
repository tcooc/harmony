const Promise = require('bluebird');
const logger = require('logger');
const request = Promise.promisifyAll(require('request'));

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

function getFile(url) {
	return request.getAsync({url: url, encoding: null}).then(function(response) {
		if(response.statusCode !== 200) {
			return Promise.reject(response);
		}
		return response.body;
	});
}

function getChannel(client, channelId) {
	var channel = client.channels.find('id', channelId);
	if(!channel) {
		var user = client.users.find('id', channelId);
		channel = client.channels.find(channel => channel.recipient && channel.recipient.id === user.id);
	}
	if(!channel) {
		logger.error('channel ' + channelId + ' not found');
	}
	return channel;
}

module.exports = {
	getChannel: getChannel,
	getFile: getFile,
	helpers: {
		simpleGET: simpleGET
	}
};
