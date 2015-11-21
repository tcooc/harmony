var Discord = require('discord.js');

module.exports = function(messaging) {
	messaging.addCommandHandler(/^!invite/i, function(message, content) {
		if(content[1].indexOf('discord.gg') > -1 && message.channel instanceof Discord.PMChannel) {
			messaging.client.joinServer(content[1], function(err, server) {
				if(err) {
					messaging.client.sendMessage(message.channel, 'Something went wrong, please contact admins');
				} else {
					messaging.client.sendMessage(message.channel, 'Joined successfully');
				}
			});
			return true;
		}
	});
};
