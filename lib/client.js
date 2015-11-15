var _ = require('underscore');
var Discord = require('discord.js');
var request = require('request');
var secrets = require('../secrets');

function start(handler) {
	var client = new Discord.Client();
	client.on('message', function(message) {
		if(message.author.username === client.user.username) {
			return;
		}
		handler(client, message);
	});

	var queue = [];
	var queueInterval = null;
	function messageInterval() {
		if(queue.length === 0) {
			clearInterval(queueInterval);
			queueInterval = null;
		} else {
			var message = queue.shift();
			client.sendMessage(message.channel, message.body);
		}
	}
	function sendMessage(client, channel, body) {
		queue.push({channel: channel, body: body});
		if(!queueInterval) {
			queueInterval = setInterval(messageInterval, 1000);
		}
	}

	client.login(secrets.email, secrets.password);

	return {client: client, sendMessage: sendMessage};
}



module.exports = {
	start: start
};
