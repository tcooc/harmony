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
			bot.helpers.simpleGET('http://wf.tcooc.net/market?q=' + query).then(function(body) {
				messaging.send(message, body);
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
		return bot.helpers.simpleGET('http://wf.tcooc.net/events.json').then(function(body) {
			return JSON.parse(body);
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
				var message = event.Messages.find((message) => message.LanguageCode === config.lang) || event.Messages[0];
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

	client.on('ready', function() {
		updateBroadcasts()
		.then(function() {
			setInterval(updateEventsLoop, NEWS_INTERVAL);
		});
	});
};
