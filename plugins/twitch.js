var _ = require('underscore');
var events = require('events');
var logger = require('logger');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var db = require('db');

var STREAMS_URL = 'https://api.twitch.tv/kraken/streams';

function getStreamsUrl(clientid, channel) {
	if(Array.isArray(channel)) {
		channel = channel.join(',');
	}
	return STREAMS_URL + '?client_id=' + encodeURIComponent(clientid) + '&channel=' + encodeURIComponent(channel);
}

module.exports = function(messaging, client) {
	var client_id = messaging.settings.twitch.client_id;
	// map of stream->broadcast specs
	var channelWatchers;
	// channel status values: false, true, timestamp
	// if false, means that status hasn't been initiated
	// if true, means that status has been initiated, and stream was offline
	// if timestamp, means that status has been initiated, and stream was online
	var channelsStatus = {};

	var timeout;

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
				var channel = client.channels.get(watcher);
				logger.info('Stream started: ' + stream.channel.display_name + ' ' + stream.game);
				messaging.send(channel, '**' + stream.channel.display_name + '** is now streaming ' + (stream.game ? stream.game : '') +
					' @ https://www.twitch.tv/' + name);
			});
		}
	});

	// each spec has stream and broadcast
	function loadWatchers(specs) {
		channelWatchers = {};
		_.each(specs, function(spec) {
			if(!channelWatchers[spec.stream]) {
				channelWatchers[spec.stream] = [];
			}
			channelWatchers[spec.stream].push(spec.broadcast);
			channelsStatus[spec.stream] = channelsStatus[spec.stream] || false;
		});
	}

	function getStreams() {
		return request.getAsync(getStreamsUrl(client_id, Object.keys(channelWatchers)))
		.then(function(response) {
			logger.silly('getStreams', response.body);
			if(response.headers['content-type'] !== 'application/json') {
				logger.warn('getStreams returned invalid content type');
				return [];
			} else {
				return JSON.parse(response.body).streams;
			}
		})
		.catch(function(error) {
			logger.error('getStreams error', error);
		});
	}

	function update() {
		return getStreams().then(function(streams) {
			var streamsMap = {};
			_.each(streams, function(stream) {
				streamsMap[stream.channel.name] = stream;
			});
			_.each(channelWatchers, function(broadcast, name) {
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
			timeout = setTimeout(updateLoop, 30 * 1000);
		});
	}

	messaging.addCommandHandler(/^!twitch/i, function(message, content) {
		if(!messaging.hasAuthority(message)) {
			return;
		}
		var username = content[1];
		db.update(function(data) {
			var index = data.twitch.findIndex((spec) => spec.broadcast === message.channel.id);
			if(username) {
				data.twitch[index] = {
					stream: username,
					broadcast: message.channel.id
				};
				messaging.send(message, 'Channel following Twitch stream `' + username + '`');
			} else {
				data.twitch.splice(index, 1);
				messaging.send(message, 'Channel follow removed');
			}
			loadWatchers(data.twitch);
		});
		return true;
	});

	messaging.addCleanup(function() {
		clearTimeout(timeout);
	});

	db.get().then(function(data) {
		loadWatchers(data.twitch);
		updateLoop();
		logger.info('Twitch plugin started with spec.length=' + data.twitch.length);
	});
};
