const _ = require('underscore');
const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'));
const URL = require('url');

const YoutubePlayable = require('./YoutubePlayable');
const TwitchPlayable = require('./TwitchPlayable');

const GOOGLE_PLAYLIST_API = 'https://www.googleapis.com/youtube/v3/playlistItems';

class AudioManager {
	constructor(settings) {
		this.settings = settings;
		this.defaultOptions = {volume: 0.2};
		this.eventBus = new EventEmitter();

		this.voiceConnection = null;
		this.currentlyPlaying = null;
		this.queue = [];

		this.played = [];
		this.loop = false;
		this.shuffle = false;
	}

	static createFromVoiceConnection(settings, voiceConnection) {
		var manager = new AudioManager(settings);
		manager.voiceConnection = voiceConnection;
		return manager;
	}

	join(voiceChannel) {
		var promise;
		if(!this.voiceConnection) {
			promise = voiceChannel.join().then((connection) => {
				this.voiceConnection = connection;
			});
		} else {
			promise = Promise.resolve();
		}
		return promise;
	}

	// start playing next item in the queue, if possible
	start() {
		if(!this.currentlyPlaying) {
			if(this.queue.length) {
				var playable = this.queue.shift();
				this.currentlyPlaying = playable;
				playable.play();
				playable.stream.on('error', (e) => {
					this.eventBus.emit('error', new Error(e));
				});
				if(playable instanceof YoutubePlayable) {
					playable.stream.on('info', (info) => {
						this.eventBus.emit('playing', playable, info);
					});
				} else {
					this.eventBus.emit('playing', playable);
				}
				var dispatcher = this.voiceConnection.playStream(playable.stream, _.extend({}, this.defaultOptions, playable.options));
				dispatcher.on('end', () => {
					this.stop();
					if(this.loop) {
						this.played.push(playable);
					}
					this.start();
				});
				dispatcher.on('error', (e) => {
					this.eventBus.emit('error', new Error(e));
				});
			} else if(this.loop && this.played.length) {
				// queue is empty but looping is enabled, loop it
				if(this.shuffle) {
					this.addPlayable(_.shuffle(this.played));
				} else {
					this.addPlayable(this.played);
				}
				this.played = [];
				this.start();
			}
		}
	}

	// stops currently playing audio
	// note that the audio manager is designed to autoplay the next item in the queue after the current one is stopped
	stop() {
		if(this.voiceConnection && this.currentlyPlaying) {
			this.currentlyPlaying.stop();
			this.eventBus.emit('stopping', this.currentlyPlaying);
			this.currentlyPlaying = null;
		}
	}

	// remove url from queue, and schedule for removal from currently playing
	remove(url) {
		if(this.currentlyPlaying && this.currentlyPlaying.url === url) {
			this.currentlyPlaying.disabled = true;
		}
		this.queue = _.filter(this.queue, (playable) => playable.url !== url);
		this.played = _.filter(this.played, (playable) => playable.url !== url);
	}

	// clears all queues, and stops playing
	clear() {
		if(this.currentlyPlaying) {
			this.currentlyPlaying.disabled = true;
		}
		this.queue = [];
		this.played = [];
		this.stop();
	}

	// play an item, or add it to the queue depending on current state
	play() {
		return this._addFromUrl.apply(this, arguments).then((status) => {
			this.start();
			return status;
		});
	}

	addPlayable(playable) {
		if(Array.isArray(playable)) {
			playable.forEach((playable) => this.addPlayable(playable));
		} else if(!playable.disabled) {
			this.queue.push(playable);
		}
	}

	// resolves with array of added playlist items
	_addFromUrl(urlString, output) {
		var url = URL.parse(urlString, true);
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
			addPromise = Promise.resolve(new TwitchPlayable(urlString, this.settings.twitch.client_id, output));
		} else {
			addPromise = Promise.reject('did not match any playables');
		}
		return addPromise.then((playables) => {
			this.addPlayable(playables);
			return playables;
		});
	}

	setLooping(loop, shuffle) {
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
	}
}

module.exports = AudioManager;
