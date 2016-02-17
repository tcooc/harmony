var _ = require('underscore');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var logger = require('logger');

var bot = require('lib/bot');

module.exports = function(messaging, client) {
	messaging.addCommandHandler(/^!trader/i, function(message) {
		bot.helpers.simpleGET('http://wf.tcooc.net/trader').then(function(body) {
			client.sendMessage(message.channel, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!deals?/i, function(message) {
		bot.helpers.simpleGET('http://wf.tcooc.net/deal').then(function(body) {
			client.sendMessage(message.channel, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!scans?/i, function(message) {
		bot.helpers.simpleGET('http://wf.tcooc.net/scan').then(function(body) {
			client.sendMessage(message.channel, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!sorties?/i, function(message) {
		bot.helpers.simpleGET('http://wf.tcooc.net/sortie').then(function(body) {
			client.sendMessage(message.channel, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!invasions?/i, function(message) {
		bot.helpers.simpleGET('http://wf.tcooc.net/invasion').then(function(body) {
			client.sendMessage(message.channel, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!wiki/i, function(message, content) {
		if(content.length > 1) {
			// check if page exists, kinda
			var url = 'https://warframe.wikia.com/wiki/';
			url += _.map(content.slice(1), function(n) {
				return n[0].toUpperCase() + n.substring(1);
			}).join('_');
			request.headAsync(url).then(function(response) {
				if(response.statusCode !== 200) {
					return;
				}
				client.sendMessage(message.channel, url);
			});
			return true;
		}
	});

	messaging.addCommandHandler(/^!trialstats?/i, function(message) {
		client.sendMessage(message.channel,
			'Hek: http://tinyurl.com/qb752oj Nightmare: http://tinyurl.com/p8og6xf Jordas: http://tinyurl.com/prpebzh');
		return true;
	});
};
