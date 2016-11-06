var _ = require('underscore');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));

var bot = require('lib/bot');
var logger = require('logger');
var db = require('db');

module.exports = function(messaging, client) {
	messaging.addCommandHandler(/^!trader/i, function(message) {
		bot.helpers.simpleGET('http://wf.tcooc.net/trader').then(function(body) {
			messaging.send(message, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!deals?/i, function(message) {
		bot.helpers.simpleGET('http://wf.tcooc.net/deal').then(function(body) {
			messaging.send(message, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!scans?/i, function(message) {
		bot.helpers.simpleGET('http://wf.tcooc.net/scan').then(function(body) {
			messaging.send(message, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!sorties?/i, function(message) {
		bot.helpers.simpleGET('http://wf.tcooc.net/sortie').then(function(body) {
			messaging.send(message, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!invasions?/i, function(message) {
		bot.helpers.simpleGET('http://wf.tcooc.net/invasion').then(function(body) {
			messaging.send(message, body);
		});
		return true;
	});

	messaging.addCommandHandler(/^!sheev/i, function(message, content) {
		var qs = encodeURIComponent(content.slice(1).join(' '));
		bot.helpers.simpleGET('http://wf.tcooc.net/sheev/strats?q=' + qs).then(function(body) {
			messaging.send(message, body);
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
				messaging.send(message, url);
			});
			return true;
		}
	});

	messaging.addCommandHandler(/^!trialstats?/i, function(message) {
		messaging.send(message,
			'Hek: http://tinyurl.com/qb752oj Nightmare: http://tinyurl.com/p8og6xf Jordas: http://tinyurl.com/prpebzh');
		return true;
	});

	// events
	var warframeEventBroadcasts;

	function updateEvents() {
		return bot.helpers.simpleGET('http://wf.tcooc.net/events.json').then(function(body) {
			var events = JSON.parse(body);
			return db.update(function(data) {
				return _.filter(events, function(event) {
					var isNew = !data.warframeEvents[event._id.$id];
					data.warframeEvents[event._id.$id] = true;
					return isNew;
				});
			});
		});
	}

	function updateEventsLoop() {
		updateEvents()
		.then(function(newEvents) {
			return Promise.all(_.map(newEvents, fillEvent));
		})
		.then(function(newEvents) {
			logger.debug('new events', newEvents);
			_.each(newEvents, function(event) {
				_.each(warframeEventBroadcasts, function(config) {
					var message = event.Messages.find((message) => message.LanguageCode === config.lang) || event.Messages[0];
					logger.debug('sending', message);
					if(event.image) {
						config.channel.sendFile.apply(config.channel, formatMessage(event, message));
					} else {
						config.channel.sendMessage.apply(config.channel, formatMessage(event, message));
					}
				});
			});
		});
	}

	function fillEvent(event) {
		return bot.getFile(event.ImageUrl).then(function(data) {
			event.image = new Buffer(data, 'binary');
			return event;
		}).catch(function() {
			return event;
		});
	}

	function formatMessage(event, message) {
		var file = event.image;
		var content = message.Message + '(' + event.Prop + ')';
		if(file) {
			return [file, event.ImageUrl.split('/').pop(), content];
		}
		return [content];
	}

	client.on('ready', function() {
		db.get().then(function(data) {
			warframeEventBroadcasts = _.mapObject(data.warframeEventBroadcasts, function(config, id) {
				config = _.clone(config);
				config.channel = bot.getChannel(client, id);
				return config;
			});
		})
		.then(updateEvents)
		.then(function() {
			setInterval(updateEventsLoop, 30 * 1000);
		});
	});
};
