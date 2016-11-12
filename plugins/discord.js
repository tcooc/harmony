const Discord = require('discord.js');
const Constants = require('discord.js/src/util/Constants');
const logger = require('logger');

module.exports = function(messaging, client) {
	messaging.addCommandHandler(/^!prefix/i, function(message, content) {
		if(!messaging.hasAuthority(message)) {
			return;
		}
		if(content.length === 1) {
			messaging.send(message, 'Prefix for this server is \'' + messaging.getPrefix(message) + '\'');
		} else {
			var prefix = content[1];
			if(prefix === '<none>') {
				prefix = '';
			}
			if(messaging.setPrefix(message, prefix)) {
				messaging.send(message, 'Prefix for this server set to \'' + prefix + '\'');
			}
		}
		return true;
	});

	messaging.addCommandHandler(/^!avatar/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		client.user.setAvatar(content[1]);
		return true;
	});

	messaging.addCommandHandler(/^!username/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		client.user.setUsername(content[1]);
		return true;
	});

	function joinServer(invite) {
		return client.rest.makeRequest('post', Constants.Endpoints.invite(invite.code), true);
	}

	function getAuthUrl(client_id) {
		return 'https://discordapp.com/oauth2/authorize?client_id=' + client_id + '&scope=bot';
	}

	messaging.addCommandHandler(/^!invite/i, function(message, content) {
		if(message.channel instanceof Discord.DMChannel) {
			if(client.user.bot) {
				messaging.send(message, 'Server owners/admins can invite me using ' + getAuthUrl(messaging.settings.discord.client_id));
			} else {
				client.fetchInvite(content[1]).then(function(invite) {
					return joinServer(invite);
				}).then(function(invite) {
					logger.debug(invite);
					messaging.send(message, 'Joined ' + invite.guild.name + ' successfully');
				}).catch(function(e) {
					logger.debug(e);
					messaging.send(message, 'Something is wrong with the invite url, please try again');
				});
			}
		} else {
			messaging.send(message.author, 'Please invite using PM');
		}
		return true;
	});
};
