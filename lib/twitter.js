function createStream(client, follow) {
	return new Promise(function(resolve, reject) {
		client.stream('statuses/filter', {follow: follow}, resolve);
	});
}

module.exports = {
	createStream: createStream
};
