var _ = require('underscore');
var events = require('events');
var logger = require('logger');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));

var STREAMS_URL = 'https://api.twitch.tv/kraken/streams?channel=';

module.exports = function(messaging, client) {
	var specs = messaging.settings.twitch.value();

	var channelWatchers = {};
	var channelsStatus = {};
	_.each(specs, function(spec) {
		if(!channelWatchers[spec.stream]) {
			channelWatchers[spec.stream] = [];
		}
		channelWatchers[spec.stream].push(spec.broadcast);
		channelsStatus[spec.stream] = null;
	});
	var channels = Object.keys(channelWatchers);

	var eventBus = new events.EventEmitter();

	eventBus.on('update', function(name, stream) {
		var status = !!stream;
		if(channelsStatus[name] !== null && channelsStatus[name] !== status) {
			eventBus.emit('statusChanged', name, stream, status);
		}
		channelsStatus[name] = status;
	});

	eventBus.on('statusChanged', function(name, stream, status) {
		if(status) {
			var watchers = channelWatchers[name];
			_.each(watchers, function(watcher) {
				var channel = client.channels.get('id', watcher);
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
			logger.debug('streams', streams);
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
		update().then(function() {
			setTimeout(updateLoop, 30 * 1000);
		});
	}

	updateLoop();
	logger.info('Twitch plugin started');
};
