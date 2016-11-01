var Discord = require('discord.js');
var logger = require('logger');

module.exports = function(messaging, client) {
	messaging.addCommandHandler(/^!invite/i, function(message, content) {
		if(message.channel instanceof Discord.PMChannel) {
			client.joinServer(content[1], function(err, server) {
				if(err) {
					client.sendMessage(message.channel, 'Something is wrong with the invite url, please try again');
				} else {
					client.sendMessage(message.channel, 'Joined ' + server.name + ' successfully');
				}
			});
			return true;
		}
	});
};
