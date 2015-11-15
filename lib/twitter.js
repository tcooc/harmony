var Twitter = require('twitter');
var secrets = require('../secrets');

var client = new Twitter({
	consumer_key: secrets.twitter.consumer_key,
	consumer_secret: secrets.twitter.consumer_secret,
	access_token_key: secrets.twitter.access_token_key,
	access_token_secret: secrets.twitter.access_token_secret
});

function createStream(follow) {
	return new Promise(function(resolve, reject) {
		client.stream('statuses/filter', {follow: follow}, resolve);
	});
}


module.exports = {
	client: client,
	createStream: createStream
};
