var _ = require('underscore');
var Twitter = require('twitter');
var twitter = require('../lib/twitter');
var secrets = require('../secrets');

var client = new Twitter({
	consumer_key: secrets.twitter.consumer_key,
	consumer_secret: secrets.twitter.consumer_secret,
	access_token_key: secrets.twitter.access_token_key,
	access_token_secret: secrets.twitter.access_token_secret
});


function createTwitterPlugin(twitterId, channelIds, accept) {
	return function(messaging) {
		var channels = _.map(channelIds, function(id) {
			return messaging.client.channels.get('id', id);
		});
		twitter.createStream(client, twitterId).then(function(stream) {
			stream.on('data', function(tweet) {
				console.log('Tweet:' + tweet.text);
				if(tweet.user.id_str === twitterId && !tweet.retweeted_status && accept.test(tweet.text)) {
					_.each(channels, function(channel) {
						client.sendMessage(channel, tweet.text);
					});
				}
			});
			stream.on('error', function(error) {
				throw error;
			});
		});
	};
}

module.exports = createTwitterPlugin;
