var _ = require('underscore');
var child_process = require('child_process');
var Discord = require('discord.js');
var db = require('db');
var util = require('util');
var vm = require('vm');
var logger = require('logger');

module.exports = function(messaging, client) {
	messaging.addHook(function(message) {
		var content = message.content;
		if(message.attachments && message.attachments[0]) {
			content += ' (' + message.attachments[0].url + ')';
		}
		logger.info(message.author.username + '(' + message.author.id + ')',
			message.channel.name + '(' + message.channel.id + ')',
			content);
		logger.silly(util.inspect(message, {depth: 1, colors: true}));
	});

	messaging.addHook(function(message) {
		if(message.channel instanceof Discord.PMChannel) {
			client.sendMessage(client.users.get('id', messaging.settings.owner),
				'`' + message.content + '` from ' + message.author.username + '(' + message.author.id + ')');
		}
	});

	messaging.addCommandHandler(/^!eval/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length <= 1) {
			return;
		}
		logger.debug('eval', content);
		try {
			var result = eval('(' + content.slice(1).join(' ') + ')'); // jshint ignore:line
			logger.info(util.inspect(result, {depth: 1, colors: true}));
			client.sendMessage(message.channel, result.toString());
		} catch(e) {
			logger.info(e.stack);
			client.sendMessage(message.channel, '```'+ e.stack + '```');
		}
		return true;
	});

	messaging.addCommandHandler(/^!run/i, function(message, content) {
		if(content.length <= 1) {
			return;
		}
		setTimeout(function() {
			var result;
			try {
				result = vm.runInNewContext(content.slice(1).join(' '), {}, {timeout: 1000, filename: 'run'});
			} catch(e) {
				result = e.toString();
				if(!(e instanceof SyntaxError) && e.stack) {
					var stack = e.stack.split('\n');
					// if run in a new context, the stack only goes 4 levels deep
					result = result + '\n' + stack.slice(0, stack.length - 4).join('\n');
				}
				result = '```'+ result + '```';
			}
			client.sendMessage(message.channel, result);
		}, 0);
		return true;
	});

	messaging.addCommandHandler(/^!message:channel/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length < 3) {
			return;
		}
		var to = client.channels.get('id', content[1]);
		var text = content.slice(2).join(' ');
		if(to) {
			logger.info('Sending ' + text + ' to ' + to.id);
			client.sendMessage(to, text);
		}
		return true;
	});

	messaging.addCommandHandler(/^!message:user/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length < 3) {
			return;
		}
		var to = client.users.get('id', content[1]);
		var text = content.slice(2).join(' ');
		if(to) {
			logger.info('Sending ' + text + ' to ' + to.id);
			client.sendMessage(to, text);
		}
		return true;
	});

	messaging.addCommandHandler(/^!stats/i, function(message) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		var servers = client.servers.length;
		var users = client.users.length;
		client.sendMessage(message.channel, 'Connected to ' + servers + ' servers with a total of ' + users + ' users.');
		return true;
	});

	messaging.addCommandHandler(/^!reload/i, function(message) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		logger.info('Triggering reload');
		child_process.exec('git pull', function() {
			process.kill(process.pid, 'SIGINT');
		});
		return true;
	});

	messaging.addCommandHandler(/^!prefix/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner && !messaging.isOwner(message.author, message.channel.server)) {
			return;
		}
		if(content.length === 1) {
			client.sendMessage(message.channel, 'Prefix for this server is \'' + messaging.getPrefix(message) + '\'');
		} else {
			var prefix = content[1];
			if(prefix === '<none>') {
				prefix = '';
			}
			messaging.setPrefix(message, prefix);
			client.sendMessage(message.channel, 'Prefix for this server set to \'' + prefix + '\'');
		}
		return true;
	});

	messaging.addCommandHandler(/^!loglevel/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		var level = content[1];
		if(content[1] && ['info', 'debug', 'silly'].indexOf(content[1]) > -1) {
			db('settings').chain().first().assign({'logLevel': level}).value();
			logger.transports.console.level = level;
			client.sendMessage(message.channel, 'Log level set to `' + level + '`');
		} else {
			client.sendMessage(message.channel, 'Invalid log level');
		}
		return true;
	});


	messaging.addCommandHandler(/^!clear/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner && !messaging.isOwner(message.author, message.channel.server)) {
			return;
		}
		var type = content[1];
		var promise = client.getChannelLogs(message.channel, 100);
		if(type !== 'all') {
			promise = promise.then(function(messages) {
				return _.filter(messages, function(message) {
					return message.author.id === client.user.id;
				});
			});
		}
		promise = promise.then(function(messages) {
			_.each(messages, function(message) {
				promise = promise.then(function(response) {
					if(response) logger.error(response);
					return client.deleteMessage(message);
				});
			});
		});
		return true;
	});

};

