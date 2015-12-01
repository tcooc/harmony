var _ = require('underscore');
var Discord = require('discord.js');
var Twitter = require('twitter');
var logger = require('logger');

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
						updateAlertMessage(message);
					}));
				});
			});
			return promise;
		}

		function doUpdateAlertMessage(message, timestamp, content) {
			var duration = (+ALERT_TWEET_REGEX.exec(content)[1]) * MINUTE;
			var expiresAt = timestamp + duration;
			var expiresIn = (expiresAt - Date.now()) / MINUTE;
			logger.debug('Twitter: expires in ', + expiresIn);
			if(expiresIn <= 0) {
				client.deleteMessage(message);
			} else {
				var newContent = message.content.replace(ALERT_TWEET_REGEX, '- ' + Math.round(expiresIn)  + 'm -');
				if(newContent !== message.content) {
					client.updateMessage(message, newContent);
				}
				logger.debug('Twitter: binding timeout ', message.content, content);
				setTimeout(doUpdateAlertMessage.bind(null, message, timestamp, content), 10 * SECOND);
			}
		}

		function updateAlertMessage(message) {
			logger.debug('Twitter: updating message ' + message.content);
			if(ALERT_TWEET_REGEX.test(message.content)) {
				return doUpdateAlertMessage(message, message.editedTimestamp || message.timestamp, message.content);
			}
		}

		function handleTweet(tweet) {
			logger.debug('Tweet: ' + tweet.text, tweet.user.id_str, !tweet.retweeted_status);
			if(tweet.user.id_str === twitterFollow && !tweet.retweeted_status) {
				logger.info('Tweet broadcasting: ' + tweet.text);
				_.each(broadcasts, function(broadcast) {
					if(broadcast.accept.test(tweet.text)) {
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

		client.on('ready', function() {
			_.each(twitterBroadcasts, function(twitterBroadcast) {
				broadcasts.push({
					channels: _.map(twitterBroadcast.channels, function(channelId) {
						var channel = client.channels.get('id', channelId);
						if(channel) {
							return channel;
						} else {
							logger.error('channel ' + channelId + ' not found');
						}
					}),
					accept: new RegExp(twitterBroadcast.accept)
				});
			});
			_.each(broadcasts, function(broadcast) {
				cleanup(broadcast.channels, 500);
			});
			logger.info('Twitter broadcasting ' + broadcasts.length + ' stream(s).');
		});

		twitter.createStream(plugin.client, twitterFollow).then(function(stream) {
			plugin.stream = stream;
			return stream;
		})
		.then(function(stream) {
			stream.on('data', handleTweet);
			stream.on('error', function(error) {
				logger.error('Twitter error: ' + error.source);
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

		messaging.addCommandHandler(/^alertme/i, function(message, content) {
			if(content.length === 1) {
				return true;
			}
			var pattern = content.slice(1).join(' ').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
			var previous = _.findIndex(broadcasts, function(broadcast) {
				var channel = broadcast.channels[0];
				return broadcast.channels === 1 && channel instanceof Discord.User && channel.equals(message.author);
			});
			var broadcast = {
				channels: [message.author],
				accept: new RegExp(pattern)
			};
			if(previous < 0) {
				broadcasts.push(broadcast);
			} else {
				broadcasts[previous] = broadcast;
			}
			client.sendMessage(message.author, 'Watching for "' + pattern + '"');
			return true;
		});
	};

	return plugin;
}

module.exports = createTwitterPlugin;
