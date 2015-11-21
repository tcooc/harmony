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
					var result = eval(content.splice(1).join(' '));
					messaging.client.sendMessage(message.channel, message.content);
				} catch(e) {
					messaging.client.sendMessage(message.channel, e.toString());
				}
			}
		});
	};
};
