var _ = require('underscore');
var Twitter = require('twitter');
var twitter = require('../lib/twitter');

function createTwitterPlugin(twitterKeys, twitterId, channelIds, accept) {
	var twitterClient = new Twitter(twitterKeys);
	return function(messaging) {
		var channels = _.map(channelIds, function(id) {
			return messaging.client.channels.get('id', id);
		});
		console.log(channels);
		twitter.createStream(twitterClient, twitterId).then(function(stream) {
			stream.on('data', function(tweet) {
				console.log('Tweet:' + tweet.text);
				console.log(tweet.user.id_str, tweet.retweeted_status, tweet.text, accept);
				if(tweet.user.id_str === twitterId && !tweet.retweeted_status && accept.test(tweet.text)) {
					_.each(channels, function(channel) {
						messaging.client.sendMessage(channel, tweet.text);
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
