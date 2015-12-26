var _ = require('underscore');
var child_process = require('child_process');
var URL = require('url');
var logger = require('logger');
var ytdl = require('ytdl-core');


var YTDL_OPTIONS = {
	quality: 'lowest',
	filter: function(format) {
		return format.container === 'mp4' && !!format.audioEncoding;
	}
};

module.exports = function(messaging, client) {
	var currentlyPlaying = null;

	function joinVoiceChannel(output, channel) {
		if(channel) {
			client.joinVoiceChannel(channel);
			client.sendMessage(output, 'Joining ' + channel);
		} else {
			client.sendMessage(output, 'Channel not found');
		}
	}

	function stopPlaying(output) {
		if(client.voiceConnection) {
			if(client.voiceConnection.instream) {
				client.voiceConnection.instream.on('error', function(e) {
					logger.error(e);
				});
			}
			client.voiceConnection.stopPlaying();
			if(currentlyPlaying) {
				currentlyPlaying.stop();
				currentlyPlaying = null;
			}
		}
	}

	function leaveVoiceChannel(output) {
		stopPlaying(output);
		client.leaveVoiceChannel();
		client.sendMessage(output, 'Leaving voice channel');
	}

	function playStream(output, stream, options) {
		return client.voiceConnection.playRawStream(stream, options)
		.then(function(intent) {
			intent.on('end', function() {
				client.sendMessage(output, 'Finished playing');
			});
			intent.on('error', function(e) {
				logger.error(e);
			});
		});
	}

	function playYoutube(output, urlString, options) {
		var url = URL.parse(urlString, true);
		var videoId = url.query ? url.query.v: null;

		if(url.hostname !== 'www.youtube.com' || url.pathname !== '/watch') {
			client.sendMessage(output, 'Your link is broked');
		} else {
			var youtubeUrl = 'https://www.youtube.com/watch?v=' + videoId;
			var stream = ytdl(youtubeUrl, YTDL_OPTIONS);

			stream.on('info', function(info, format) {
				logger.debug('stream info');
				logger.debug(info);
				logger.debug(format);
				client.sendMessage(output, 'Playing **' + info.title + '**');
			});

			stream.on('response', function(response) {
				logger.debug('stream response');
				logger.debug(response);
			});

			stream.on('error', function(e) {
				logger.error(e);
			});

			currentlyPlaying = {
				stop: function() {
					stream.end();
					stream.destroy();
				}
			};
			playStream(output, stream, options);
		}
	}

	function playTwitch(output, url, options) {
		var process = child_process.spawn('livestreamer', [url, 'worst', '--stdout'], {stdio: ['ignore', 'pipe', 'ignore']});
		var stream = process.stdout;
		currentlyPlaying = {
			stop: function() {
				process.kill('SIGINT');
			}
		};
		playStream(output, stream, options);
	}

	messaging.addCommandHandler(/^!voice:joinid/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length <= 1) {
			return;
		}
		joinVoiceChannel(message.channel, client.channels.get('id', content[1]));
		return true;
	});

	messaging.addCommandHandler(/^!voice:join/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length <= 1) {
			return;
		}
		var name = content.slice(1).join(' ');
		joinVoiceChannel(message.channel, _.find(message.channel.server.channels, function(channel) {
			return channel.type === 'voice' && channel.name === name;
		}));
		return true;
	});

	messaging.addCommandHandler(/^!voice:play/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length <= 1) {
			return;
		}
		if(!client.voiceConnection) {
			client.sendMessage(message.channel, 'Dude, I\'m not connected to a voice channel');
		} else {
			playYoutube(message.channel, content[1], {volume: 0.5});
		}
		return true;
	});

	messaging.addCommandHandler(/^!voice:stream/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length <= 1) {
			return;
		}
		if(!client.voiceConnection) {
			client.sendMessage(message.channel, 'Dude, I\'m not connected to a voice channel');
		} else {
			playTwitch(message.channel, content[1], {volume: 0.5});
		}
		return true;
	});

	messaging.addCommandHandler(/^!voice:stop/i, function(message) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		if(!client.voiceConnection) {
			client.sendMessage(message.channel, 'Not playing anything');
		} else {
			stopPlaying(message.channel);
			client.sendMessage(message.channel, 'Stopping');
		}
		return true;
	});

	messaging.addCommandHandler(/^!voice:leave/i, function(message) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		leaveVoiceChannel(message.channel);
		return true;
	});

};

