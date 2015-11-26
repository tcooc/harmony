var Discord = require('discord.js');
var request = require('request');

function create(interval, backlog) {
	var client = new Discord.Client();
	var _sendMessage = client.sendMessage;

	var queue = [];
	var queueInterval = null;
	function messageInterval() {
		if(queue.length === 0) {
			clearInterval(queueInterval);
			queueInterval = null;
		} else {
			var args = queue.shift();
			_sendMessage.apply(client, args);
		}
	}

	client.sendMessage = function() {
		if(queue.length <= backlog) {
			queue.push(arguments);
		} else {
			console.warn('too many messages queued, discarding');
		}
		if(!queueInterval) {
			queueInterval = setInterval(messageInterval, interval);
		}
	};

	return client;
}

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
	create: create,
	helpers: {
		simpleGET: simpleGET
	}
};
