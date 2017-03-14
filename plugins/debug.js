var child_process = require('child_process');
var Discord = require('discord.js');
var db = require('db');
var util = require('util');
var vm = require('vm');
var logger = require('logger');

module.exports = function(messaging, client) {
	messaging.addHook(function(message) {
		var content = message.content;
		if(message.attachments.size) {
			message.attachments.forEach((attachment) => {
				content += ' (' + attachment.url + ')';
			});
		}
		var info = [message.author.username + '(' + message.author.id + ')'];
		if(message.guild) {
			info.push(message.guild.name);
		}
		if(message.channel.name) {
			info.push(message.channel.name);
		}
		info.push('(' + message.channel.id + ')');
		info.push(content);
		logger.info(info.join(' '));
		logger.silly(util.inspect(message, {depth: 1, colors: true}));
	});

	messaging.addPostHook(function(message, handled) {
		if(!handled && message.channel instanceof Discord.DMChannel) {
			messaging.send(client.users.get(messaging.settings.owner),
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
			messaging.send(message, result.toString());
		} catch(e) {
			logger.info(e.stack);
			messaging.send(message, '```'+ e.stack + '```');
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
			messaging.send(message, result);
		}, 0);
		return true;
	});

	messaging.addCommandHandler(/^!message:channel/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length < 3) {
			return;
		}
		var to = client.channels.get(content[1]);
		var text = content.slice(2).join(' ');
		if(to) {
			logger.info('Sending ' + text + ' to ' + to.id);
			messaging.send(to, text);
		}
		return true;
	});

	messaging.addCommandHandler(/^!message:user/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length < 3) {
			return;
		}
		var to = client.users.get(content[1]);
		var text = content.slice(2).join(' ');
		if(to) {
			logger.info('Sending ' + text + ' to ' + to.id);
			messaging.send(to, text);
		}
		return true;
	});

	messaging.addCommandHandler(/^!stats/i, function(message) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		var servers = client.guilds.size;
		var users = client.users.size;
		messaging.send(message, 'Connected to ' + servers + ' servers with a total of ' + users + ' users.');
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

	messaging.addCommandHandler(/^!loglevel/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		var level = content[1];
		if(content[1] && ['info', 'debug', 'silly'].indexOf(content[1]) > -1) {
			db.update(function(data) {
				data.settings.logLevel = level;
			});
			logger.transports.console.level = level;
			messaging.send(message, 'Log level set to `' + level + '`');
		} else {
			messaging.send(message, 'Invalid log level');
		}
		return true;
	});


	messaging.addCommandHandler(/^!clear/i, function(message, content) {
		if(!messaging.hasAuthority(message)) {
			return;
		}
		var type = content[1];
		var promise = message.channel.fetchMessages({limit: 100});
		if(type !== 'all') {
			promise = promise.then(function(messages) {
				return messages.filter(function(message) {
					return message.author.id === client.user.id;
				});
			});
		}
		promise = promise.then(function(messages) {
			messages.forEach(function(message) {
				promise = promise.then(function() {
					return message.delete();
				});
			});
		});
		return true;
	});

};

