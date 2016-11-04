var Discord = require('discord.js');
var Constants = require('discord.js/src/util/Constants');
var logger = require('logger');

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

	function joinServer(invite) {
		return client.rest.makeRequest('post', Constants.Endpoints.invite(invite.code), true);
	}

	messaging.addCommandHandler(/^!invite/i, function(message, content) {
		if(message.channel instanceof Discord.DMChannel) {
			client.fetchInvite(content[1]).then(function(invite) {
				return joinServer(invite);
			}).then(function(server) {
				logger.debug(server);
				messaging.send(message, 'Joined ' + server.name + ' successfully');
			}).catch(function(e) {
				logger.debug(e);
				messaging.send(message, 'Something is wrong with the invite url, please try again');
			});
			return true;
		}
	});
};
