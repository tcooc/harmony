module.exports = function(owner) {
	return function(messaging) {
		messaging.addHook(function(message) {
			console.log(message.author.username + '(' + message.author.id + ')',
				message.channel.name + '(' + message.channel.id + ')',
				message.content);
		});

		messaging.addCommandHandler(/^!eval/i, function(message, content) {
			if(message.author.id === owner && content.length > 1) {
				try {
					var result = eval(content.slice(1).join(' ')); // jshint ignore:line
					messaging.client.sendMessage(message.channel, result);
				} catch(e) {
					messaging.client.sendMessage(message.channel, '```'+ e.stack + '```');
				}
				return;
			}
		});

		messaging.addCommandHandler(/^!stats/i, function(message, content) {
			if(message.author.id === owner) {
				var servers = messaging.client.servers.length;
				var users = messaging.client.users.length;
				messaging.client.sendMessage(message.channel, 'Connected to ' + servers + ' servers with a total of ' + users + ' users.');
			}
		});
	};
};
