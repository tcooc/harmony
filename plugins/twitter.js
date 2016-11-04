var _ = require('underscore');
var Twit = require('twit');
var logger = require('logger');
var db = require('db');

var ALERT_TWEET_REGEX = /- ([0-9]+)m -/;
var SECOND = 1000;
var MINUTE = 60 * SECOND;

module.exports = function(messaging, client) {
	var twitterFollow = messaging.settings.twitterFollow;
	var twitterBroadcasts;
	var twitterClient = new Twit(messaging.settings.twitter);
	var stream;
	var broadcasts = [];

	function parseBroadcastSpec(twitterBroadcast) {
		var newBroadcast = {
			for: twitterBroadcast.for,
			channels: _.map(twitterBroadcast.channels, function(channelId) {
				var channel = client.channels.find('id', channelId);
				if(!channel) {
					var user = client.users.find('id', channelId);
					channel = client.channels.find(channel => channel.recipient && channel.recipient.id === user.id);
				}
				if(channel) {
					return channel;
				} else {
					logger.error('channel ' + channelId + ' not found');
				}
			}),
			accept: new RegExp(twitterBroadcast.accept, 'i')
		};
		if(twitterBroadcast.for) {
			var index = _.findIndex(broadcasts, function(broadcast) {
				return twitterBroadcast.for === broadcast.for;
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

	function cleanup(channels, amount) {
		var promise = Promise.resolve();
		_.each(channels, function(channel) {
			promise = promise.then(function() {
				return channel.fetchMessages({limit: amount});
			})
			.then(function(messages) {
				return messages.filter(function(message) {
					return message.author.id === client.user.id;
				});
			})
			.then(function(messages) {
				return Promise.all(messages.map(function(message) {
					return updateAlertMessage(message);
				}));
			});
		});
		return promise;
	}

	function doUpdateAlertMessage(message, timestamp, content) {
		var duration = (+ALERT_TWEET_REGEX.exec(content)[1]) * MINUTE;
		var expiresAt = timestamp + duration;
		var expiresIn = (expiresAt - Date.now()) / MINUTE;
		logger.silly('Twitter: expires in ', + expiresIn);
		if(expiresIn <= 0) {
			return message.delete();
		} else {
			var newContent = message.content.replace(ALERT_TWEET_REGEX, '- ' + Math.round(expiresIn)  + 'm -');
			var promise = newContent !== message.content ? message.edit(newContent) : Promise.resolve(message);
			return promise.then(function(message) {
				logger.silly('Twitter: scheduling tick ', message.content, content);
				setTimeout(doUpdateAlertMessage.bind(null, message, timestamp, content), 10 * SECOND);
			});
		}
	}

	function updateAlertMessage(message) {
		if(ALERT_TWEET_REGEX.test(message.content)) {
			logger.debug('Twitter: updating message ' + message.content);
			return doUpdateAlertMessage(message, message.editedTimestamp || message.timestamp, message.content);
		}
	}

	function handleTweet(tweet) {
		logger.debug('Tweet: ' + tweet.text, tweet.user.id_str, !tweet.retweeted_status);
		if(tweet.user.id_str === twitterFollow && !tweet.retweeted_status) {
			logger.info('Tweet broadcasting: ' + tweet.text);
			_.each(broadcasts, function(broadcast) {
				var filteredText =  tweet.text.replace(' Informant ', ''); // pending regex fix
				if(broadcast.accept.test(filteredText)) {
					logger.debug('Tweet accepted by ' + broadcast.accept);
					messaging.broadcast(broadcast.channels, tweet.text)
					.then(function(results) {
						logger.debug('Tweet broadcasted to ' + results.length);
						_.each(results, function(message) {
							updateAlertMessage(message);
						});
					});
				}
			});
		}
	}

	db.get().then(function(data) {
		twitterBroadcasts = data.twitterBroadcasts;

		stream = twitterClient.stream('statuses/filter', {follow: twitterFollow});
		stream.on('tweet', handleTweet);
		stream.on('error', function(error) {
			logger.error('Twitter error: ' + error.source);
			throw error;
		});

		client.on('ready', function() {
			_.each(twitterBroadcasts, parseBroadcastSpec);
			_.each(broadcasts, function(broadcast) {
				cleanup(broadcast.channels, 100).catch(function(e) {
					logger.error(e);
				});
			});
			logger.info('Twitter broadcasting ' + broadcasts.length + ' stream(s).');
		});

		logger.info('Twitter stream created.');
	});

	messaging.addCommandHandler(/^!alertme:info/i, function(message) {
		var broadcast = twitterBroadcasts.find((broadcast) => broadcast.for === message.author.id);
		if(broadcast) {
			messaging.send(message.author, 'Your current watch list: `' + broadcast.accept.split('|').join(' ') + '`');
		}
		return true;
	});

	messaging.addCommandHandler(/^!alertme:stop/i, function(message) {
		logger.debug('Broadcasts before remove: ' + broadcasts.length);
		var index = _.findIndex(broadcasts, (broadcast) => broadcast.for === message.author.id);
		if(index > -1) {
			broadcasts.splice(index, 1);
		}
		index = _.findIndex(twitterBroadcasts, (broadcast) => broadcast.for === message.author.id);
		if(index > -1) {
			twitterBroadcasts.splice(index, 1);
			db.update(function(data) {
				data.twitterBroadcasts = twitterBroadcasts;
			});
		}
		logger.debug('Broadcasts after remove: ' + broadcasts.length);
		messaging.send(message.author, 'Alerts stopped.');
		return true;
	});

	messaging.addCommandHandler(/^!alertme/i, function(message, content) {
		var watchList = content.slice(1);
		var correctList = _.all(watchList, function(watch) {
			return /^[A-Za-z]+$/.test(watch);
		});
		if(watchList.length === 0 || !correctList) {
			messaging.send(message.author,
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
			var previous = _.findIndex(twitterBroadcasts, (broadcast) => broadcast.for === twitterBroadcast.for);
			if(previous > -1) {
				twitterBroadcasts[previous] = twitterBroadcast;
			} else {
				twitterBroadcasts.push(twitterBroadcast);
			}
			db.update(function(data) {
				data.twitterBroadcasts = twitterBroadcasts;
			});
			_.each(twitterBroadcasts, parseBroadcastSpec);
			logger.debug('Broadcasts after add: ' + broadcasts.length);
			messaging.send(message.author, 'Watching for `' + pattern.split('|').join(' ') + '`');
		}
		return true;
	});

	messaging.addCleanup(function() {
		stream.stop();
	});
};
