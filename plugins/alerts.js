var _ = require('underscore');
var Promise = require('bluebird');
var logger = require('logger');
var request = require('request');

var bot = require('lib/bot');

var ALERT_TWEET_REGEX = /- ([0-9]+)m -/;
var SECOND = 1000;
var MINUTE = 60 * SECOND;

function initializeCommands(messaging, client) {
	messaging.addCommandHandler(/^!alertme:info/i, function(message) {
		var broadcast = twitterBroadcasts.find({for: message.author.id});
		if(broadcast) {
			client.sendMessage(message.author, 'Your current watch list: `' + broadcast.accept.split(' ') + '`');
		}
		return true;
	});

	messaging.addCommandHandler(/^!alertme:stop/i, function(message) {
		logger.debug('Broadcasts before remove: ' + broadcasts.length);
		var index = _.findIndex(broadcasts, function(broadcast) {
			return broadcast.for === message.author.id;
		});
		if(index > -1) {
			broadcasts.splice(index, 1);
		}
		twitterBroadcasts.remove({for: message.author.id});
		logger.debug('Broadcasts after remove: ' + broadcasts.length);
		client.sendMessage(message.author, 'Alerts stopped.');
		return true;
	});

	messaging.addCommandHandler(/^!alertme/i, function(message, content) {
		var watchList = content.slice(1);
		var correctList = _.all(watchList, function(watch) {
			return /^[A-Za-z]+$/.test(watch);
		});
		if(watchList.length === 0 || !correctList) {
			client.sendMessage(message.author,
				'Give me a space-separated list of items you want to watch for.\n' +
				'I recommend: `!alertme Reactor Catalyst Forma Nitain`.\n' +
				'To see your current watch list, use `!alertme:info`\n' +
				'To stop receiving notifications, use `!alertme:stop`');
		} else {
			var pattern = watchList.join('|');
			var twitterBroadcast = {
				for: message.author.id,
				channels: [message.author.id],
				accept: pattern
			};
			logger.info('Adding broadcast spec for ' + message.author.username, twitterBroadcast);
			logger.debug('Broadcasts before add: ' + broadcasts.length);
			var previous = twitterBroadcasts.find({for: twitterBroadcast.for});
			if(previous) {
				twitterBroadcasts.chain().find({for: twitterBroadcast.for}).assign(twitterBroadcast).value();
			} else {
				twitterBroadcasts.push(twitterBroadcast);
			}
			parseBroadcastSpec(twitterBroadcast);
			logger.debug('Broadcasts after add: ' + broadcasts.length);
			client.sendMessage(message.author, 'Watching for `' + pattern + '`');
		}
		return true;
	});
}

module.exports = function(messaging, client) {
	var alertBroadcasts = messaging.settings.alertBroadcasts;
	var broadcasts = [];

	var alertMap = {};

	// run on ready, parses specs and adds them to broadcast array
	function parseBroadcastSpec(broadcastSpec) {
		var newBroadcast = {
			for: broadcastSpec.for,
			channels: _.map(broadcastSpec.channels, function(channelId) {
				var channel = client.channels.get('id', channelId) || client.users.get('id', channelId);
				if(channel) {
					return channel;
				} else {
					logger.error('channel ' + channelId + ' not found');
				}
			}),
			accept: new RegExp(broadcastSpec.accept, 'i')
		};
		if(broadcastSpec.for) {
			var index = _.findIndex(broadcasts, function(broadcast) {
				return broadcastSpec.for === broadcast.for;
			});
			if(index >= 0) {
				broadcasts[index] = newBroadcast;
			} else {
				broadcasts.push(newBroadcast);
			}
		} else {
			broadcasts.push(newBroadcast);
		}
	}

	function updateAlertMap() {
		return bot.helpers.simpleGET('http://wf.tcooc.net/alert').then(function(body) {
			var alerts = body.split('\n')
			var newAlerts = [];
			_.each(alerts, function(alert) {
				var separator = alert.lastIndexOf(' - ');
				var id = alert.substring(0, separator);
				var time = parseInt(alert.substring(separator + 3, alert.length - 1));
				if(!alertMap[id]) {
					newAlerts.push(id);
				}
				alertMap[id] = {text: alert, time: time, added: Date.now()};
			});
			_.each(alertMap, function(key, value) {
				if((Date.now() - value.added) > value.time * SECOND + MINUTE) {
					delete alertMap[key];
				}
			});
			return newAlerts;
		});
	}

	function handleNewAlert(alert) {
		_.each(broadcasts, function(broadcast) {
			if(broadcast.accept.test(alert.text)) {
				logger.debug('Alert accepted by ' + broadcast.accept);
				messaging.broadcast(broadcast.channels, 'Alert: ' + alert.text);
			}
		});
	}

	function update() {
		return updateAlertMap()
			.then(function(newAlerts) {
				_.each(newAlerts, handleNewAlert);
			});
	}

	client.on('ready', function() {
		alertBroadcasts.each(parseBroadcastSpec);
		updateAlertMap().then(function() {
			setInterval(update, 60 * 1000);
			logger.info('Alerts broadcasting ' + broadcasts.length + ' stream(s).');
		});
	});

	initializeCommands(messaging, client);
};
