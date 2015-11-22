var _ = require('underscore');
var Twitter = require('twitter');
var twitter = require('../lib/twitter');

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
	};
}

module.exports = createTwitterPlugin;
