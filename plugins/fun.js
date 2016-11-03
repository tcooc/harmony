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

	var readyData;
	messaging.addCommandHandler(/^!ready/i, function(message) {
		var promise;
		if(!readyData) {
			promise = request.getAsync({url: 'http://tinyurl.com/BodyisReady123', encoding: null})
			.then(function(response) {
				readyData = response.body;
			});
		} else {
			promise = Promise.resolve();
		}
		promise.then(function() {
			client.sendFile(message.channel, new Buffer(readyData, 'binary'), 'ready.gif');
		});
		return true;
	});
};
