var bot = require('lib/bot');

module.exports = function(messaging) {
	messaging.addCommandHandler(/^soon/i, function(message) {
		messaging.send(message, 'Soon' + String.fromCharCode(8482));
		return true;
	});

	messaging.addCommandHandler(/^!unflip/i, function(message) {
		messaging.send(message, '┬─┬ ◟(`ﮧ´ ◟ )');
		return true;
	});

	messaging.addCommandHandler(/^!flip/i, function(message) {
		messaging.send(message, '(╯°□°）╯︵ ┻━┻');
		return true;
	});

	var readyData;
	messaging.addCommandHandler(/^!ready/i, function(message) {
		if(!readyData) {
			readyData = bot.getFile('http://tinyurl.com/BodyisReady123');
		}
		readyData.then(function(data) {
			message.channel.sendFile(data, 'ready.gif');
		});
		return true;
	});
};
