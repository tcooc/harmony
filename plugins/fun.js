module.exports = function(messaging, client) {
	messaging.addCommandHandler(/^soon/i, function(message) {
		client.sendMessage(message.channel, 'Soon' + String.fromCharCode(8482));
		return true;
	});

	messaging.addCommandHandler(/^!unflip/i, function(message) {
		client.sendMessage(message.channel, '┬─┬ ◟(`ﮧ´ ◟ )');
		return true;
	});

	messaging.addCommandHandler(/^!unflip/i, function(message) {
		client.sendMessage(message.channel, '(╯°□°）╯︵ ┻━┻');
		return true;
	});

	messaging.addCommandHandler(/^!ready/i, function(message) {
		client.sendMessage(message.channel, 'http://tinyurl.com/BodyisReady123');
		return true;
	});
};
