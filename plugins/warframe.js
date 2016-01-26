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

	client.on('ready', function() {
		var enemyData = {};
		function processEnemyData(data, send) {
			var enemies = data.split('\n');
			for(var i = 0; i < enemies.length; i++) {
				var enemy = enemies[i].split(', ');
				var name = enemy[1];
				var data = {
					level: enemy[0],
					found: enemy[2] === 'true',
					health: (enemy[3] * 100).toFixed(2),
					region: enemy[4],
					mission: enemy[5]
				};
				if(send && data.found && !enemyData[name].found) {
					client.sendMessage(client.channels.get('id', '83810681152868352'), name + ' was detected in ' + data.region);
				}
				if(send && data.mission !== enemyData[name].mission) {
					client.sendMessage(client.channels.get('id', '83810681152868352'), name + ' was found in ' + data.mission + ', ' + data.region);
				}
				if(send && !data.found && enemyData[name].found) {
					client.sendMessage(client.channels.get('id', '83810681152868352'), name + ' went back into hiding');
				}
				enemyData[name] = data;
			}
		}
		logger.debug('Checking enemies list');
		bot.helpers.simpleGET('http://wf.tcooc.net/enemy').then(function(body) {
			processEnemyData(body, false);
		}).then(function() {
			logger.debug('Starting enemy locator');
			setInterval(function() {
				bot.helpers.simpleGET('http://wf.tcooc.net/enemy').then(function(body) {
					processEnemyData(body, true);
				});
			}, 10 * 1000);
		});
	});
};
