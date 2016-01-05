var _ = require('underscore');
var child_process = require('child_process');
var EventEmitter = require('events').EventEmitter;
var logger = require('logger');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var URL = require('url');
var ytdl = require('ytdl-core');

var AudioTypes = {
	Youtube: 'youtube',
	Twitch: 'twitch'
};

var PlayStatus = _.extend({
	Playlist: 'playlist',
	Invalid: 'invalid'
}, AudioTypes);

var YTDL_OPTIONS = {
	quality: 'lowest',
	filter: function(format) {
		return format.container === 'mp4' && !!format.audioEncoding;
	}
};

var GOOGLE_PLAYLIST_API = 'https://www.googleapis.com/youtube/v3/playlistItems';

function AudioManager(messaging) {
	this.messaging = messaging;
	this.client = messaging.client;
	this.eventBus = new EventEmitter();
	this._resetCurrentlyPlaying();
	this.queue = [];
}

AudioManager.prototype._resetCurrentlyPlaying = function() {
	this.currentlyPlaying = {
		stop: function() {}
	};
};

AudioManager.prototype._setCurrentlyPlaying = function(currentlyPlaying) {
	var stop = currentlyPlaying.stop;
	currentlyPlaying.stop = function() {
		stop();
		this._resetCurrentlyPlaying();
	}.bind(this);
	this.currentlyPlaying = currentlyPlaying;
};

AudioManager.prototype.start = function() {
	if(!this.currentlyPlaying.spec && this.queue.length) {
		var spec = this.queue.shift();
		if(spec.type === AudioTypes.Youtube) {
			this._playYoutube(spec);
		} else if(spec.type === AudioTypes.Twitch) {
			this._playTwitch(spec);
		} else {
			logger.error('Unknown spec', spec);
		}
	}
};

AudioManager.prototype.stop = function() {
	logger.debug('AudioManager.stop');
	if(this.client.voiceConnection) {
		if(this.client.voiceConnection.instream) {
			this.client.voiceConnection.instream.on('error', function(e) {
				logger.error(e);
			});
		}
		this.currentlyPlaying.stop();
	}
};

AudioManager.prototype._playStream = function(output, stream, options) {
	stream.on('error', function(e) {
		logger.error(e);
	});
	return this.client.voiceConnection.playRawStream(stream, options)
	.then(function(intent) {
		intent.on('end', function() {
			this.stop();
			this.start();
		}.bind(this));
		intent.on('error', function(e) {
			logger.error(e);
		});
	}.bind(this));
};

AudioManager.prototype._playYoutube = function(spec) {
	var url = URL.parse(spec.url, true);
	var videoId = url.query ? url.query.v: null;
	var youtubeUrl = 'https://www.youtube.com/watch?v=' + videoId;
	var stream = ytdl(youtubeUrl, YTDL_OPTIONS);

	stream.on('info', function(info, format) {
		logger.debug('stream info');
		logger.debug(info);
		logger.debug(format);
		this.eventBus.emit('playing', spec, info);
	}.bind(this));

	stream.on('response', function(response) {
		logger.debug('stream response');
		logger.debug(response);
	});

	stream.on('error', function(e) {
		logger.error(e);
	});

	this._setCurrentlyPlaying({
		spec: spec,
		stop: function() {
			logger.debug('stopping youtube');
			this.eventBus.emit('stopping', spec);
			stream.unpipe();
			stream.end();
		}.bind(this)
	});
	this._playStream(spec.output, stream, spec.options);
};

AudioManager.prototype._playTwitch = function(spec) {
	var process = child_process.spawn('livestreamer', [spec.url, 'worst', '--stdout'], {stdio: ['ignore', 'pipe', 'ignore']});
	var stream = process.stdout;
	this._setCurrentlyPlaying({
		spec: spec,
		stop: function() {
			logger.debug('stopping twitch');
			this.eventBus.emit('stopping', spec);
			stream.unpipe();
			process.kill('SIGINT');
		}.bind(this)
	});
	this._playStream(spec.output, stream, spec.options);
	this.eventBus.emit('playing', spec);
};

AudioManager.prototype.clear = function() {
	this.queue = [];
};

AudioManager.prototype.play = function(output, urlString, options) {
	var url = URL.parse(urlString, true);
	logger.debug(url);
	if(url.hostname === 'www.youtube.com' && url.pathname === '/watch') {
		this.queue.push({type: AudioTypes.Youtube, output: output, url: urlString, options: options});
		this.start();
		return Promise.resolve(PlayStatus.Youtube);
	} else if(url.hostname === 'www.youtube.com' && url.pathname === '/playlist' && url.query.list) {
		logger.info('Fetching playlist', url.query.list);
		return request.getAsync({
			url: GOOGLE_PLAYLIST_API,
			qs: {
				part: 'contentDetails',
				maxResults: 50,
				playlistId: url.query.list,
				key: this.messaging.settings.google.key
			}
		}).then(function(response) {
			if(response.statusCode !== 200) {
				return PlayStatus.Invalid;
			}
			logger.debug(response.body);
			logger.debug(response.statusCode);
			this.client.sendMessage(output, 'Playlist added');
//			this.start();
			return PlayStatus.Playlist;
		}.bind(this))
		.catch(function(e) {
			logger.error(e);
			return PlayStatus.Invalid;
		});
	} else if(url.hostname === 'www.twitch.tv') {
		this.queue.push({type: AudioTypes.Twitch, output: output, url: urlString, options: options});
		this.start();
		return Promise.resolve(PlayStatus.Twitch);
	} else {
		return Promise.resolve(PlayStatus.Invalid);
	}
};

module.exports = {
	AudioManager: AudioManager,
	PlayStatus: PlayStatus
};