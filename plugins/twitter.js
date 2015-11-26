var _ = require('underscore');
var Twitter = require('twitter');
var twitter = require('../lib/twitter');

var ALERT_TWEET_REGEX = /- ([0-9]+)m -/;

function createTwitterPlugin(twitterFollow, twitterBroadcasts) {
	return function(messaging, client) {
		var twitterClient = new Twitter(messaging.settings.twitter);

		var broadcasts = [];

		client.on('ready', function() {
			_.each(twitterBroadcasts, function(twitterBroadcast) {
				broadcasts.push({
					channels: _.map(twitterBroadcast.channels, function(channelId) {
						var channel = client.channels.get('id', channelId);
						if(channel) {
							return channel;
						} else {
							console.error('channel ' + channelId + ' not found');
						}
					}),
					accept: new RegExp(twitterBroadcast.accept)
				});
			});
			console.log('Twitter broadcasting ' + broadcasts.length + ' stream(s).');
		});

		twitter.createStream(twitterClient, twitterFollow).then(function(stream) {
			stream.on('data', function(tweet) {
				console.log('Tweet:' + tweet.text, tweet.user.id_str, !!tweet.retweeted_status);
				if(tweet.user.id_str === twitterFollow && !tweet.retweeted_status) {
					_.each(broadcasts, function(broadcast) {
						if(broadcast.accept.test(tweet.text)) {
							messaging.broadcast(broadcast.channels, tweet.text);
						}
					});
				}
			});
			stream.on('error', function(error) {
				console.error('Twitter error:');
				console.error(error);
				throw error;
			});
		});

		function cleanup(channels, amount, output) {
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
							var duration = (+match[1]) * 60 * 1000;
							var timestamp = message.timestamp;
							if(Date.now() - timestamp > duration) {
								return client.deleteMessage(message);
							}
						}
					}));
				});
			});
			return promise;
		}

		messaging.addCommandHandler(/^!twitter:clean/i, function(message, content) {
			if(message.author.id !== messaging.settings.owner) {
				return;
			}
			var index = content.length > 1 ? +content[1] : 0;
			cleanup(broadcasts[index].channels, 500, message.channel)
			.then(function() {
				client.sendMessage(message.channel, 'finished cleaning ' + index);
			});
			return true;
		});
	};
}

module.exports = createTwitterPlugin;
