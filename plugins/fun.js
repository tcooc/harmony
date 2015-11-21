var Discord = require('discord.js');

module.exports = function(messaging) {
	messaging.addCommandHandler(/^soon/i, function(message, content) {
		messaging.client.sendMessage(message.channel, 'Soon' + String.fromCharCode(8482));
		return true;
	});

	messaging.addCommandHandler(/^!unflip/i, function(message, content) {
		messaging.client.sendMessage(message.channel, '┬─┬ ◟(`ﮧ´ ◟ )');
		return true;
	});

	messaging.addCommandHandler(/^!unflip/i, function(message, content) {
		messaging.client.sendMessage(message.channel, '(╯°□°）╯︵ ┻━┻');
		return true;
	});
};
