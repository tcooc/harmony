var vm = require('vm');
var logger = require('logger');

module.exports = function(messaging, client) {
	messaging.addHook(function(message) {
		logger.info(message.author.username + '(' + message.author.id + ')',
			message.channel.name + '(' + message.channel.id + ')',
			message.content);
		logger.debug(message);
	});

	messaging.addCommandHandler(/^eval/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length <= 1) {
			return;
		}
		try {
			var result = eval(content.slice(1).join(' ')); // jshint ignore:line
			logger.info(result);
			client.sendMessage(message.channel, result);
		} catch(e) {
			client.sendMessage(message.channel, '```'+ e.stack + '```');
		}
		return true;
	});

	messaging.addCommandHandler(/^run/i, function(message, content) {
		if(content.length <= 1) {
			return;
		}
		setTimeout(function() {
			var result;
			try {
				result = vm.runInNewContext(content.slice(1).join(' '), {}, {timeout: 1000, filename: 'run'});
			} catch(e) {
				logger.info(e.stack);
				if(!(e instanceof SyntaxError)) {
					var stack = e.stack.split('\n');
					// if run in a new context, the stack only goes 4 levels deep
					stack.splice(stack.length - 4);
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

	messaging.addCommandHandler(/^stats/i, function(message) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		var servers = client.servers.length;
		var users = client.users.length;
		client.sendMessage(message.channel, 'Connected to ' + servers + ' servers with a total of ' + users + ' users.');
		return true;
	});

};

