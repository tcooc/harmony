var _ = require('underscore');
var Discord = require('discord.js');
var request = require('request');
var secrets = require('../secrets');

function start(handler) {
	var client = new Discord.Client();
	var _sendMessage = client.sendMessage;
	client.on('message', function(message) {
		if(message.author.username === client.user.username) {
			return;
		}
		handler(message);
	});
	client.on('disconnected', function() {
		throw new Error('disconnected');
	});
	client.on('error', function(error) {
		console.error(error);
		throw new Error('discord client error');
	});

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
		queue.push(arguments);
		if(!queueInterval) {
			queueInterval = setInterval(messageInterval, 1000);
		}
	};

	client.login(secrets.email, secrets.password);

	return client;
}



module.exports = {
	start: start
};
