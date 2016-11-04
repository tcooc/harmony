var Discord = require('discord.js');

module.exports = function(messaging, client) {
	messaging.addCommandHandler(/^!prefix/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner && !messaging.isOwner(message.author, message.channel.server)) {
			return;
		}
		if(content.length === 1) {
			messaging.send(message, 'Prefix for this server is \'' + messaging.getPrefix(message) + '\'');
		} else {
			var prefix = content[1];
			if(prefix === '<none>') {
				prefix = '';
			}
			messaging.setPrefix(message, prefix);
			messaging.send(message, 'Prefix for this server set to \'' + prefix + '\'');
		}
		return true;
	});

	messaging.addCommandHandler(/^!invite/i, function(message, content) {
		if(message.channel instanceof Discord.DMChannel) {
			client.joinServer(content[1], function(err, server) {
				if(err) {
					messaging.send(message, 'Something is wrong with the invite url, please try again');
				} else {
					messaging.send(message, 'Joined ' + server.name + ' successfully');
				}
			});
			return true;
		}
	});
};
