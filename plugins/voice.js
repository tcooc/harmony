const _ = require('underscore');
const Discord = require('discord.js');
const AudioManager = require('lib/audio/AudioManager');
const AudioClips = require('lib/audio/AudioClips');
const FilePlayable = require('lib/audio/FilePlayable');
const logger = require('logger');

module.exports = function(messaging, client) {
	var audioManager = new AudioManager(messaging.settings);
	audioManager.eventBus.on('error', function(e) {
		logger.error(e.stack);
	});
	audioManager.shuffle = true;

	audioManager.eventBus.on('playing', function(playable, info) {
		if(info) {
			messaging.send(playable.output, 'Playing **' + info.title + '**');
		} else {
			messaging.send(playable.output, 'Playing **' + playable + '**');
		}
	});

	audioManager.eventBus.on('stopping', function(playable) {
		messaging.send(playable.output, 'Finished playing ' + playable);
	});

	messaging.addCommandHandler(/^!audio:play/i, function(message, content) {
		if(content.length <= 1) {
			audioManager.start();
		} else {
			var promise;
			if(!audioManager.voiceConnection) {
				var userVoiceChannel = client.channels.find((channel) => {
					return channel instanceof Discord.VoiceChannel && channel.members.find((member) => member.id === message.author.id);
				});
				if(!userVoiceChannel) {
					messaging.send(message, 'Dude, you\'re not connected to a voice channel');
					return true;
				}
				promise = userVoiceChannel.join().then(function(connection) {
					audioManager.voiceConnection = connection;
				});
			} else {
				promise = Promise.resolve();
			}
			promise.then(function() {
				var urlString = content[1];
				if(urlString.startsWith('www')) {
					urlString = 'http://' + urlString;
				}
				return audioManager.play(urlString, message.channel);
			}).then(function(playables) {
				if(playables.length > 1) {
					messaging.send(message, 'Playlist added');
				} else {
					messaging.send(message, 'Added to queue');
				}
			}, function(e) {
				logger.warn(e);
				messaging.send(message, 'Your link is broken');
			});
		}
		return true;
	});

	messaging.addCommandHandler(/^!audio:loop/i, function(message, content) {
		var loop = content[1] ? !!parseInt(content[1]) : audioManager.loop;
		var shuffle = content[2] ? !!parseInt(content[2]) : audioManager.shuffle;
		audioManager.setLooping(loop, shuffle);
		messaging.send(message, 'Looping ' + (audioManager.loop ? 'enabled' : 'disabled') +
			', shuffle ' + (audioManager.shuffle ? 'enabled' : 'disabled'));
		return true;
	});

	messaging.addCommandHandler(/^!audio:next/i, function(message) {
		if(!audioManager.voiceConnection) {
			messaging.send(message, 'Not playing anything');
		} else {
			audioManager.stop();
		}
		return true;
	});

	messaging.addCommandHandler(/^!audio:remove/i, function(message, content) {
		logger.debug('playing', audioManager.currentlyPlaying ? audioManager.currentlyPlaying.toString() : 'nothing');
		logger.debug('queue', _.pluck(audioManager.queue, 'url'));
		logger.debug('played', _.pluck(audioManager.played, 'url'));
		var url = content[1];
		if(url) {
			audioManager.remove(url);
		}
		return true;
	});

	messaging.addCommandHandler(/^!audio:clear/i, function(message) {
		audioManager.clear();
		messaging.send(message, 'Cleared player');
		return true;
	});

	messaging.addCommandHandler(/^!audio:leave/i, function(message) {
		audioManager.stop();
		audioManager.voiceConnection.disconnect();
		audioManager.voiceConnection = null;
		messaging.send(message, 'Leaving voice channel');
		return true;
	});

	var audioclips = new AudioClips('./.audio').load();

	messaging.addCommandHandler(/^!shodan/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		var index = content[1] ? parseInt(content[1]) : -1;
		if(!isFinite(index) || index < 0 || index >= audioclips.files.length) {
			index = Math.floor(Math.random() * audioclips.files.length);
		}
		audioclips.then(function(audioclips) {
			var filePlayable = new FilePlayable(audioclips.files[index]);
			filePlayable.disabled = true;
			audioManager.queue.unshift(filePlayable);
			audioManager.stop();
			audioManager.start();
		});
	});
};
