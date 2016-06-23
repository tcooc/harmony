var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));

module.exports = function(messaging, client) {
	messaging.addCommandHandler(/^soon/i, function(message) {
		client.sendMessage(message.channel, 'Soon' + String.fromCharCode(8482));
		return true;
	});

	messaging.addCommandHandler(/^!unflip/i, function(message) {
		client.sendMessage(message.channel, '┬─┬ ◟(`ﮧ´ ◟ )');
		return true;
	});

	messaging.addCommandHandler(/^!flip/i, function(message) {
		client.sendMessage(message.channel, '(╯°□°）╯︵ ┻━┻');
		return true;
	});

	messaging.addCommandHandler(/^!ready/i, function(message) {
		request.getAsync({url: 'http://tinyurl.com/BodyisReady123', encoding: null})
		.then(function(response) {
			client.sendFile(message.channel, new Buffer(response.body, 'binary'), 'ready.gif');
		});
		return true;
	});
};
