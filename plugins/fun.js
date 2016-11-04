var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));

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
			message.channel.sendFile(new Buffer(readyData, 'binary'), 'ready.gif');
		});
		return true;
	});
};
