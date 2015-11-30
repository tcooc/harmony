var _ = require('underscore');
var Twitter = require('twitter');
var winston = require('winston');

var twitter = require('lib/twitter');

var ALERT_TWEET_REGEX = /- ([0-9]+)m -/;
var SECOND = 1000;
var MINUTE = 60 * SECOND;

function createTwitterPlugin(twitterFollow, twitterBroadcasts) {
	var plugin = {
		client: null,
		stream: null
	};

	plugin.link = function(messaging, client) {
		plugin.client = new Twitter(messaging.settings.twitter);

		var broadcasts = [];

		function cleanup(channels, amount) {
			var promise = Promise.resolve();
			_.each(channels, function(channel) {
				promise = promise.then(function() {
					return client.getChannelLogs(channel, amount);
				})
				.then(function(messages) {
					return _.filter(messages, function(message) {
						return message.author.id === client.user.id;
					});
				})
				.then(function(messages) {
					return Promise.all(_.map(messages, function(message) {
						var match = ALERT_TWEET_REGEX.exec(message.content);
						if(match) {
							var duration = (+match[1]) * MINUTE;
							var timestamp = message.editedTimestamp || message.timestamp;
							if(Date.now() - timestamp > duration) {
								return client.deleteMessage(message);
							}
						}
					}));
				});
			});
			return promise;
		}

		function updateAlertMessage(message) {
			var duration = (+ALERT_TWEET_REGEX.exec(message.content)[1]) * MINUTE;
			var expiresAt = message.timestamp + duration;
			var expiresIn = (expiresAt - Date.now()) / MINUTE;
			if(expiresIn <= 0) {
				client.deleteMessage(message);
			} else {
				var content = message.content.replace(ALERT_TWEET_REGEX, '- ' + Math.round(expiresIn)  + 'm -');
				if(content !== message.content) {
					client.updateMessage(message, content);
				}
				setTimeout(updateAlertMessage.bind(null, message), 10 * SECOND);
			}
		}

		function handleTweet(tweet) {
			winston.info('Tweet: ' + tweet.text, tweet.user.id_str, !tweet.retweeted_status);
			if(tweet.user.id_str === twitterFollow && !tweet.retweeted_status) {
				_.each(broadcasts, function(broadcast) {
					if(broadcast.accept.test(tweet.text)) {
						var broadcastPromise = messaging.broadcast(broadcast.channels, tweet.text);
						if(ALERT_TWEET_REGEX.test(tweet.text)) {
							broadcastPromise.then(function(results) {
								_.each(results, function(message) {
									updateAlertMessage(message);
								});
							});
						}
					}
				});
			}
		}

		client.on('ready', function() {
			_.each(twitterBroadcasts, function(twitterBroadcast) {
				broadcasts.push({
					channels: _.map(twitterBroadcast.channels, function(channelId) {
						var channel = client.channels.get('id', channelId);
						if(channel) {
							return channel;
						} else {
							winston.error('channel ' + channelId + ' not found');
						}
					}),
					accept: new RegExp(twitterBroadcast.accept)
				});
			});
			winston.info('Twitter broadcasting ' + broadcasts.length + ' stream(s).');
		});

		twitter.createStream(plugin.client, twitterFollow).then(function(stream) {
			plugin.stream = stream;
			return stream;
		})
		.then(function(stream) {
			stream.on('data', handleTweet);
			stream.on('error', function(error) {
				winston.error('Twitter error: ' + error.source);
				throw error;
			});

			return stream;
		});

		messaging.addCommandHandler(/^twitter:clean/i, function(message, content) {
			if(message.author.id !== messaging.settings.owner) {
				return;
			}
			var index = content.length > 1 ? +content[1] : 0;
			cleanup(broadcasts[index].channels, 500)
			.then(function() {
				client.sendMessage(message.channel, 'finished cleaning stream ' + index);
			});
			return true;
		});
	};

	return plugin;
}

module.exports = createTwitterPlugin;
