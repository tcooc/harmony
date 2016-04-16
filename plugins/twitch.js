var _ = require('underscore');
var events = require('events');
var logger = require('logger');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));

var STREAMS_URL = 'https://api.twitch.tv/kraken/streams?channel=';
var THRESHOLD = 3;

module.exports = function(messaging, client) {
	var specs = messaging.settings.twitch.value();

	var channelWatchers = {};
	// channel status values: false, true, timestamp
	// if false, means that status hasn't been initiated
	// if true, means that status has been initiated, and stream was offline
	// if timestamp, means that status has been initiated, and stream was online
	var channelsStatus = {};
	_.each(specs, function(spec) {
		if(!channelWatchers[spec.stream]) {
			channelWatchers[spec.stream] = [];
		}
		channelWatchers[spec.stream].push(spec.broadcast);
		channelsStatus[spec.stream] = false;
	});
	var channels = Object.keys(channelWatchers);

	var eventBus = new events.EventEmitter();

	eventBus.on('update', function(name, stream) {
		var streaming = !!stream;
		if(streaming) {
			if(channelsStatus[name] && channelsStatus[name] !== stream.created_at) {
				eventBus.emit('statusChanged', name, stream, streaming);
			}
			channelsStatus[name] = stream.created_at;
		} else {
			channelsStatus[name] = channelsStatus[name] || true;
		}
	});

	eventBus.on('statusChanged', function(name, stream, streaming) {
		if(streaming) {
			var watchers = channelWatchers[name];
			_.each(watchers, function(watcher) {
				var channel = client.channels.get('id', watcher);
				logger.info('Stream started: ' + stream.channel.display_name + ' ' + stream.game);
				client.sendMessage(channel, '**' + stream.channel.display_name + '** is now streaming ' + stream.game);
			});
		}
	});

	function getStreams() {
		return request.getAsync(STREAMS_URL + channels.join(','))
		.then(function(response) {
			return JSON.parse(response.body).streams;
		})
		.catch(function(error) {
			logger.error('getStreams error', error);
		});
	}

	function update() {
		return getStreams().then(function(streams) {
			logger.debug('streams', streams.length);
			logger.silly(JSON.stringify(streams));
			var streamsMap = {};
			_.each(streams, function(stream) {
				streamsMap[stream.channel.name] = stream;
			});
			_.each(channels, function(name) {
				if(!streamsMap[name]) {
					streamsMap[name] = null;
				}
			});
			_.each(streamsMap, function(stream, name) {
				eventBus.emit('update', name, stream);
			});
		});
	}

	function updateLoop() {
		update().finally(function() {
			setTimeout(updateLoop, 30 * 1000);
		});
	}

	updateLoop();
	logger.info('Twitch plugin started');
};
