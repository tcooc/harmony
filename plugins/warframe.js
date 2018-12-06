var _ = require('underscore');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var RichEmbed = require('discord.js').RichEmbed;

var bot = require('lib/bot');
var logger = require('logger');
var db = require('db');

var NEWS_INTERVAL = 30 * 1000;

module.exports = function(messaging, client) {
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
				messaging.send(message, url);
			});
			return true;
		}
	});

	messaging.addCommandHandler(/^!price/i, function(message, content) {
		if(content.length > 1) {
			var query = encodeURIComponent(content.slice(1).join(' '));
			bot.getResponse('https://wf.tcooc.net/market?q=' + query).then(function(response) {
				messaging.send(message, response.body.toString());
			});
		} else {
			messaging.send(message, 'Specify an item');
		}
		return true;
	});

	// events
	var warframeEventBroadcasts;

	// update local broadcast cache
	function updateBroadcasts() {
		return db.get().then(function(data) {
			warframeEventBroadcasts = {};
			_.each(data.warframeEventBroadcasts, function(config, id) {
				config = _.clone(config);
				config.channel = bot.getChannel(client, id);
				if(config.channel) {
					warframeEventBroadcasts[id] = config;
				}
			});
		});
	}

	function fetchEvents() {
		return bot.getResponse('https://wf.tcooc.net/events.json').then(function(response) {
			return JSON.parse(response.body.toString());
		});
	}

	function updateEvents(events) {
		var currentEvents = {};
		_.each(events, (event)=>currentEvents[event._id.$oid] = true);
		return db.update(function(data) {
			// keep only new events
			var newEvents = _.filter(events, (event)=>!data.warframeEvents[event._id.$oid]);
			// cleanup events
			data.warframeEvents = currentEvents;
			return newEvents;
		});
	}

	function broadcastNewEvents(newEvents) {
		if(newEvents.length) {
			logger.debug('new events', newEvents);
		}
		_.each(newEvents, function(event) {
			_.each(warframeEventBroadcasts, function(config) {
				var message = event.Messages.find((message) => message.LanguageCode === config.lang);
				if(!message) {
					return;
				}
				logger.debug('sending', message);
				var embed = _createEmbed(event, message);
				config.channel.send('', embed);
			});
		});
	}

	function updateEventsLoop() {
		fetchEvents()
		.then((events)=>updateEvents(events))
		.then((newEvents)=>broadcastNewEvents(newEvents));
	}

	function _createEmbed(event, message) {
		var embed = new RichEmbed();
		embed.setTitle(message.Message);
		embed.setURL(event.Prop);
		embed.setTimestamp(new Date(+event.Date.$date.$numberLong));
		if(event.ImageUrl) {
			embed.setImage(event.ImageUrl);
		}
		return embed;
	}

	messaging.addCommandHandler(/^!warframe:newstest/i, function(message) {
		if(!messaging.isBotAdmin(message.author)) {
			return;
		}
		fetchEvents().then(function(events) {
			_.each(events, function(event) {
				var msg = event.Messages.find((message) => message.LanguageCode === 'en') || event.Messages[0];
				var embed = _createEmbed(event, msg);
				message.channel.send('', embed);
			});
		});
		return true;
	});

	messaging.addCommandHandler(/^!warframe:news/i, function(message, content) {
		if(!messaging.hasAuthority(message)) {
			return;
		}
		var region = (content[1] || '').substring(0, 2);
		db.update(function(data) {
			if(region) {
				data.warframeEventBroadcasts[message.channel.id] = {'lang': region};
				messaging.send(message, 'Channel subscribed to PC news in `' + region + '`');
			} else {
				delete data.warframeEventBroadcasts[message.channel.id];
				messaging.send(message, 'Channel subscription removed');
			}
			updateBroadcasts();
		});
		return true;
	});

	// enemy data
	var enemyData = {};
	function enemyDataMain(send) {
		return bot.getResponse('https://wf.tcooc.net/enemy').then(response => processEnemyData(response.body.toString(), send));
	}

	function processEnemyData(responseData, send) {
		var enemies = responseData.split('\n');
		for(var i = 0; i < enemies.length; i++) {
			var enemy = enemies[i].split(', ');
			var name = enemy[1];
			var data = {
				level: enemy[0],
				found: enemy[2] === 'true',
				health: (enemy[3] * 100).toFixed(2),
				mission: enemy[4],
				region: enemy[5]
			};enemyData[name] = enemyData[name] || data;

			var channel = client.channels.get('101715629001687040');
			var trailer = ' (' + data.health + '%)';
			if(send && data.mission !== enemyData[name].mission) {
				channel.send(name + ' was found in ' + data.mission + ', ' + data.region + trailer);
			} else if(send && data.found && !enemyData[name].found) {
				channel.send(name + ' was detected in ' + data.region + trailer);
			}
			if(send && !data.found && enemyData[name].found) {
				channel.send(name + ' went back into hiding' + trailer);
			}

			enemyData[name] = data;
		}
	}

	client.on('ready', function() {
		var updateEventsInterval, enemyDataInterval;
		updateBroadcasts().then(function() {
			updateEventsInterval = setInterval(updateEventsLoop, NEWS_INTERVAL);
		});

		enemyDataMain(false).then(function() {
			if(Object.keys(enemyData)) {
				logger.debug('Starting enemy locator');
				enemyDataInterval = setInterval(enemyDataMain.bind(null, true), 10 * 1000);
			} else {
				logger.debug('No enemy data found, disabling enemy locator');
			}
		});

		messaging.addCleanup(() => {
			clearInterval(updateEventsInterval);
			clearInterval(enemyDataInterval);
		});
	});
};
