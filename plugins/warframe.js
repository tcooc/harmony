var _ = require('underscore');
var Discord = require('discord.js');
var request = require('request');

var bot = require('../lib/bot');

module.exports = function(messaging) {
	messaging.addCommandHandler(/^!trader/i, function(message, content) {
		bot.helpers.simpleGET('http://wf.tcooc.net/trader').then(function(body) {
			messaging.client.sendMessage(message.channel, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!deals?/i, function(message, content) {
		bot.helpers.simpleGET('http://wf.tcooc.net/deal').then(function(body) {
			messaging.client.sendMessage(message.channel, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!scans?/i, function(message, content) {
		bot.helpers.simpleGET('http://wf.tcooc.net/scan').then(function(body) {
			messaging.client.sendMessage(message.channel, body);
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
			request.head(url, function(error, response) {
				if(error || response.statusCode !== 200) {
					return;
				}
				messaging.client.sendMessage(message.channel, url);
			});
			return true;
		}
	});

	messaging.addCommandHandler(/^!trialstats?/i, function(message, content) {
		messaging.client.sendMessage(message.channel,
			'Hek: http://tinyurl.com/qb752oj Nightmare: http://tinyurl.com/p8og6xf Jordas: http://tinyurl.com/prpebzh');
		return true;
	});
};
