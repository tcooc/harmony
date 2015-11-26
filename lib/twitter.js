function createStream(client, follow) {
	return new Promise(function(resolve) {
		client.stream('statuses/filter', {follow: follow}, resolve);
	});
}

module.exports = {
	createStream: createStream
};
