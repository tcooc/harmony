var _ = require('underscore');
var Twit = require('twit');
var logger = require('logger');

var ALERT_TWEET_REGEX = /- ([0-9]+)m -/;
var SECOND = 1000;
var MINUTE = 60 * SECOND;

function createTwitterPlugin(twitterFollow, twitterBroadcasts) {
	var plugin = {
		client: null,
		stream: null
	};

	plugin.link = function(messaging, client) {
		plugin.client = new Twit(messaging.settings.twitter);

		var broadcasts = [];

		function parseBroadcastSpec(twitterBroadcast) {
			var newBroadcast = {
				for: twitterBroadcast.for,
				channels: _.map(twitterBroadcast.channels, function(channelId) {
					var channel = client.channels.get('id', channelId) || client.users.get('id', channelId);
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
			logger.silly('Twitter: expires in ', + expiresIn);
			if(expiresIn <= 0) {
				client.deleteMessage(message);
			} else {
				var newContent = message.content.replace(ALERT_TWEET_REGEX, '- ' + Math.round(expiresIn)  + 'm -');
				var promise = newContent !== message.content ? client.updateMessage(message, newContent) : Promise.resolve(message);
				promise.then(function(message) {
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
			twitterBroadcasts.each(parseBroadcastSpec);
			_.each(broadcasts, function(broadcast) {
				cleanup(broadcast.channels, 500);
			});
			logger.info('Twitter broadcasting ' + broadcasts.length + ' stream(s).');
		});

		plugin.stream = plugin.client.stream('statuses/filter', {follow: twitterFollow});
		plugin.stream.on('tweet', handleTweet);
		plugin.stream.on('error', function(error) {
			logger.error('Twitter error: ' + error.source);
			throw error;
		});
		logger.info('Twitter stream created.');

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
	};

	return plugin;
}

module.exports = createTwitterPlugin;
