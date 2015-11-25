var _ = require('underscore');
var Twitter = require('twitter');
var twitter = require('../lib/twitter');

var ALERT_TWEET_REGEX = /- ([0-9]+)m -/;

function createTwitterPlugin(twitterKeys, twitterId, channelIds, accept) {
	var twitterClient = new Twitter(twitterKeys);
	return function(messaging, client) {
		var channels = [];
		client.on('ready', function() {
			_.each(channelIds, function(id) {
				var channel = client.channels.get('id', id);
				if(channel) {
					channels.push(channel);
				} else {
					console.error('channel ' + id + ' not found');
				}
			});
			console.log('Twitter pushing to ' + channels.length + '/' + channelIds.length + ' channels.');
		});
		twitter.createStream(twitterClient, twitterId).then(function(stream) {
			stream.on('data', function(tweet) {
				console.log('Tweet:' + tweet.text, tweet.user.id_str, tweet.retweeted_status, accept);
				if(tweet.user.id_str === twitterId && !tweet.retweeted_status && accept.test(tweet.text)) {
					_.each(channels, function(channel) {
						client.sendMessage(channel, tweet.text);
					});
				}
			});
			stream.on('error', function(error) {
				console.error('Twitter error:');
				console.error(error);
			});
		});

		function cleanup(channels, amount, output) {
			var promise = Promise.resolve();
			_.each(channels, function(channel) {
				promise = promise.then(function() {
					client.sendMessage(output, 'cleaning ' + channel);
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
			cleanup(channels, 500, message.channel)
			.then(function() {
				client.sendMessage(message.channel, 'finished cleaning');
			});
			return true;
		});
	};
}

module.exports = createTwitterPlugin;
