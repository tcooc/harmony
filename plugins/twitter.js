var _ = require('underscore');
var Twit = require('twit');
var logger = require('logger');
var bot = require('lib/bot');
var db = require('db');

var ALERT_TWEET_REGEX = /- ([0-9]+)m -/;
var SECOND = 1000;
var MINUTE = 60 * SECOND;

module.exports = function(messaging, client) {
	var twitterFollow = messaging.settings.twitterFollow;
	var twitterClient = new Twit(messaging.settings.twitter);
	var stream;
	var broadcasts;

	function loadBroadcastSpec(twitterBroadcasts) {
		broadcasts = twitterBroadcasts.map((twitterBroadcast) => {
			return {
				for: twitterBroadcast.for,
				channel: bot.getChannel(client, twitterBroadcast.for),
				accept: new RegExp(twitterBroadcast.accept, 'i')
			};
		});
	}

	function saveBroadcastSpec(broadcast) {
		return {
			for: broadcast.for,
			accept: broadcast.accept.source
		};
	}

	function cleanup(channel, amount) {
		return channel.fetchMessages({limit: amount})
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
				setTimeout(() => doUpdateAlertMessage(message, timestamp, content), 10 * SECOND);
			});
		}
	}

	function updateAlertMessage(message) {
		if(message && message.content && ALERT_TWEET_REGEX.test(message.content)) {
			logger.debug('Twitter: updating message ' + message.content);
			return doUpdateAlertMessage(message, message.editedTimestamp || message.createdTimestamp, message.content);
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
					messaging.send(broadcast.channel, tweet.text).then(function(message) {
						return updateAlertMessage(message);
					});
				}
			});
		}
	}

	function createStream() {
		logger.debug('Creating Twitter stream');
		stream = twitterClient.stream('statuses/filter', {follow: twitterFollow});
		stream.on('tweet', handleTweet);
		stream.on('error', function(error) {
			logger.error('Twitter error: ', error);
		});
		stream.on('disconnect', function() {
			logger.error('Twitter disconnect', arguments);
			setTimeout(function() {
				createStream();
			}, 10000);
		});
	}

	db.get().then(function(data) {
		createStream();
		client.on('ready', function() {
			loadBroadcastSpec(data.twitterBroadcasts);
			_.each(broadcasts, function(broadcast) {
				if(!broadcast.channel) {
					return;
				}
				cleanup(broadcast.channel, 100).catch(function(e) {
					logger.error(e);
				});
			});
			logger.info('Twitter broadcasting ' + broadcasts.length + ' stream(s).');
		});
		logger.info('Twitter stream created.');
	});

	messaging.addCommandHandler(/^!alertme/i, function(message, content) {
		if(!messaging.hasAuthority(message)) {
			messaging.send(message.author, 'You don\'t seem to have permission to set alerts for that channel.\n' +
				' Try the command here if you want personal alerts.');
			return true;
		}
		var watchList = content.slice(1);
		var correctList = _.all(watchList, function(watch) {
			return /^[A-Za-z]+$/.test(watch);
		});
		var index = _.findIndex(broadcasts, (broadcast) => broadcast.for === message.channel.id || broadcast.for === message.author.id);
		if(watchList.length === 0 || !correctList) {
			var response = ['Subscribe to warframe alerts'];
			if(index > -1) {
				response.push('Your current watch list is: `' + broadcasts[index].accept.source.split('|').join(' ') + '`');
			}
			response.push('To set an alert, message me a comma separated list of items, like `!alertme Reactor Catalyst Forma Nitain`');
			response.push('To stop getting alerts, message `!alertme stop`');
			messaging.send(message, response.join('\n'));
		} else if (watchList.length === 1 && watchList[0] === 'stop' && index > -1) {
			broadcasts.splice(index, 1);
			db.update(function(data) {
				data.twitterBroadcasts.splice(index, 1);
			});
			messaging.send(message, 'Alerts stopped');
		} else {
			var pattern = watchList.join('|');
			var twitterBroadcast = {
				for: message.channel.id,
				channel: message.channel,
				accept: new RegExp(pattern, 'i')
			};
			logger.info('Adding broadcast spec', twitterBroadcast);
			if(index > -1) {
				broadcasts[index] = twitterBroadcast;
			} else {
				broadcasts.push(twitterBroadcast);
			}
			db.update(function(data) {
				if(index > -1) {
					data.twitterBroadcasts[index] = saveBroadcastSpec(twitterBroadcast);
				} else {
					data.twitterBroadcasts.push(saveBroadcastSpec(twitterBroadcast));
				}
			});
			messaging.send(message, 'Watching for `' + pattern.split('|').join(' ') + '`');
		}
		return true;
	});

	messaging.addCleanup(function() {
		stream.stop();
	});
};
