var Discord = require('discord.js');

module.exports = function(messaging, client) {
	messaging.addCommandHandler(/^invite/i, function(message, content) {
		if(content[1].indexOf('discord.gg') > -1 && message.channel instanceof Discord.PMChannel) {
			client.joinServer(content[1], function(err, server) {
				if(err) {
					client.sendMessage(message.channel, 'Something went wrong, please contact admins');
				} else {
					client.sendMessage(message.channel, 'Joined ' + server.name + ' successfully');
				}
			});
			return true;
		}
	});
};
