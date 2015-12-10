var db = require('db');
var util = require('util');
var vm = require('vm');
var logger = require('logger');

module.exports = function(messaging, client) {
	messaging.addHook(function(message) {
		logger.info(message.author.username + '(' + message.author.id + ')',
			message.channel.name + '(' + message.channel.id + ')',
			message.content);
		logger.debug(util.inspect(message, {depth: 1, colors: true}));
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
				logger.info(e.stack);
				if(!(e instanceof SyntaxError) && e.stack) {
					var stack = e.stack.split('\n');
					// if run in a new context, the stack only goes 4 levels deep
					stack.splice(0, stack.length - 4);
					result = stack.join('\n');
				} else {
					result = e.toString();
				}
				result = '```'+ result + '```';
			}
			client.sendMessage(message.channel, result);
		}, 0);
		return true;
	});

	messaging.addCommandHandler(/^!message/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length < 3) {
			return;
		}
		var channel = client.channels.get('id', content[1]);
		var text = content.slice(2).join(' ');
		if(channel) {
			logger.info('Sending ' + text + ' to ' + channel.id);
			client.sendMessage(channel, text);
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

};

