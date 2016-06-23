var Discord = require('discord.js');
var logger = require('logger');

module.exports = function(messaging, client) {
	// matcher
	var emotes = messaging.settings.emotes;
	messaging.addHook(function(message) {
		var regex = /<:[^:]+:\d+>/g;
		var match;
		do {
			match = regex.exec(message.content);
			if(match && !emotes[match[0]]) {
				emotes[match[0]] = 1;
				logger.info('Matched ' + match[0]);
			}
		} while(match);
		if(regex.lastIndex > 0) {
			messaging.settings.db.save();
		}
	});

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
