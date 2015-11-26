var Promise = require('bluebird');
var aiml = Promise.promisifyAll(require('aiml'));

module.exports = function(messaging, client) {
	var topics = aiml.parseDir ('aiml');
	var ready = new Promise(function(resolve, reject) {
		client.on('ready', resolve);
	});
	Promise.all([topics, ready])
	.then(function(results) {
		var engine = new aiml.AiEngine('discord', results[0], {name: client.user.username});
		messaging.addCommandHandler(/^!aiml/i, function(message, content) {
			engine.replyAsync({name: message.author.username}, content.slice(1).join(' ')).then(function(response) {
				client.sendMessage(message.channel, response);
			});
			return true;
		});
		console.log('AIML engine loaded');
	});
};
