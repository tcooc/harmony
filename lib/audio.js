const _ = require('underscore');
const child_process = require('child_process');
const EventEmitter = require('events').EventEmitter;
const logger = require('logger');
const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'));
const URL = require('url');
const ytdl = require('ytdl-core');

const YTDL_OPTIONS = {
	quality: 'lowest',
	filter: function(format) {
		return format.container === 'mp4' && !!format.audioEncoding;
	}
};

const GOOGLE_PLAYLIST_API = 'https://www.googleapis.com/youtube/v3/playlistItems';

function AudioManager(settings) {
	this.settings = settings;
	this.options = {volume: 0.1};
	this.eventBus = new EventEmitter();

	this.voiceConnection = null;
	this.currentlyPlaying = null;
	this.queue = [];

	this.played = [];
	this.loop = false;
	this.shuffle = false;
}

// start playing next item in the queue, if possible
AudioManager.prototype.start = function() {
	if(!this.currentlyPlaying) {
		var playable;
		while(this.queue.length) {
			playable = this.queue.shift();
			if(playable.disabled) {
				playable = null;
			} else {
				break;
			}
		}
		if(playable) {
			this.currentlyPlaying = playable;
			playable.play();
			playable.stream.on('error', function(e) {
				logger.error(e);
				console.trace();
			});
			if(playable instanceof YoutubePlayable) {
				playable.stream.on('info', (info) => {
					this.eventBus.emit('playing', playable, info);
				});
			} else {
				this.eventBus.emit('playing', playable);
			}
			var dispatcher = this.voiceConnection.playStream(playable.stream, this.options);
			dispatcher.on('end', () => {
				this.stop();
				if(this.loop) {
					this.played.push(playable);
				}
				this.start();
			});
			dispatcher.on('error', (e) => {
				logger.error(e);
				console.trace();
			});
		} else if(this.loop && this.played.length) {
			// queue is empty but looping is enabled, loop it
			if(this.shuffle) {
				this.queue = _.shuffle(this.played);
			} else {
				this.queue = this.played;
			}
			this.played = [];
			this.start();
		}
	}
};

// stops currently playing audio
// note that the audio manager is designed to autoplay the next item in the queue after the current one is stopped
AudioManager.prototype.stop = function() {
	logger.debug('AudioManager.stop');
	if(this.voiceConnection && this.currentlyPlaying) {
		this.currentlyPlaying.stop();
		this.eventBus.emit('stopping', this.currentlyPlaying);
		this.currentlyPlaying = null;
	}
};

// remove url from queue, and schedule for removal from currently playing
AudioManager.prototype.remove = function(url) {
	if(this.currentlyPlaying && this.currentlyPlaying.url === url) {
		this.currentlyPlaying.disabled = true;
	}
	this.queue = _.filter(this.queue, (playable) => playable.url !== url);
	this.played = _.filter(this.played, (playable) => playable.url !== url);
};

// clears all queues, and stops playing
AudioManager.prototype.clear = function() {
	if(this.currentlyPlaying) {
		this.currentlyPlaying.disabled = true;
	}
	this.queue = [];
	this.played = [];
	this.stop();
};

// play an item, or add it to the queue depending on current state
AudioManager.prototype.play = function() {
	return this._play.apply(this, arguments).then((status) => {
		this.start();
		return status;
	});
};

// resolves with array of added playlist items
AudioManager.prototype._play = function(urlString, output) {
	var url = URL.parse(urlString, true);
	logger.debug('play', url);
	var addPromise;
	if(url.hostname === 'www.youtube.com' && url.pathname === '/watch') {
		addPromise = Promise.resolve(new YoutubePlayable(urlString, output));
	} else if(url.hostname === 'www.youtube.com' && url.pathname === '/playlist' && url.query.list) {
		addPromise = request.getAsync({
			url: GOOGLE_PLAYLIST_API,
			qs: {
				part: 'contentDetails',
				maxResults: 50,
				playlistId: url.query.list,
				key: this.settings.google.key
			}
		}).then((response) => {
			if(response.statusCode !== 200) {
				throw new Error('invalid status from google playlist api ' + response.statusCode);
			}
			var playlist = JSON.parse(response.body);
			var toAdd = _(playlist.items).chain().map((item) => {
				var itemUrl = YoutubePlayable.toUrl(item.contentDetails.videoId);
				return new YoutubePlayable(itemUrl, output);
			});
			if(this.shuffle) {
				toAdd = toAdd.shuffle();
			}
			return toAdd.value();
		});
	} else if(url.hostname === 'www.twitch.tv') {
		addPromise = Promise.resolve(new TwitchPlayable(urlString, output));
	} else {
		addPromise = Promise.reject('did not match any playables');
	}
	return addPromise.then((playables) => {
		if(!Array.isArray(playables)) {
			playables = [playables];
		}
		Array.prototype.push.apply(this.queue, playables);
		return playables;
	});
};

AudioManager.prototype.setLooping = function(loop, shuffle) {
	if(typeof loop !== 'boolean') {
		throw new Error('loop parameter must be boolean');
	}
	if(this.loop !== loop) {
		this.played = [];
	}
	this.loop = loop;
	if(typeof shuffle === 'boolean') {
		this.shuffle = shuffle;
	}
};

AudioManager.createFromVoiceConnection = function(settings, voiceConnection) {
	var manager = new AudioManager(settings);
	manager.voiceConnection = voiceConnection;
	return manager;
};

function Playable(output) {
	this.output = output;
}

function YoutubePlayable(url, output) {
	Playable.call(this, output);
	this.url = url;
}
YoutubePlayable.toUrl = function(videoId) {
	return 'https://www.youtube.com/watch?v=' + videoId;
};
YoutubePlayable.prototype.play = function() {
	logger.debug('playing youtube');
	var url = URL.parse(this.url, true);
	var videoId = url.query ? url.query.v: null;
	var youtubeUrl = YoutubePlayable.toUrl(videoId);
	this.stream = ytdl(youtubeUrl, YTDL_OPTIONS);

	this.stream.on('info', function(info, format) {
		logger.debug('stream info');
		logger.debug(info);
		logger.debug(format);
	});
	return this.stream;
};
YoutubePlayable.prototype.stop = function() {
	logger.debug('stopping youtube');
	this.stream.unpipe();
	this.stream.end();
};

function TwitchPlayable(url, output) {
	Playable.call(this, output);
	this.url = url;
}
TwitchPlayable.prototype.play = function() {
	logger.debug('playing twitch');
	this.process = child_process.spawn('livestreamer', [this.url, 'worst', '--stdout'], {stdio: ['ignore', 'pipe', 'ignore']});
	this.stream = this.process.stdout;
};
TwitchPlayable.prototype.stop = function() {
	logger.debug('stopping twitch');
	this.stream.unpipe();
	this.process.kill('SIGINT');
};

module.exports = {
	AudioManager: AudioManager
};
