var _ = require('underscore');
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
	function joinVoiceChannel(channel, output) {
		if(channel) {
			client.joinVoiceChannel(channel);
			client.sendMessage(output, 'Joining ' + channel);
		} else {
			client.sendMessage(output, 'Channel not found');
		}
	}

	messaging.addCommandHandler(/^!voice:joinid/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length <= 1) {
			return;
		}
		joinVoiceChannel(client.channels.get('id', content[1]), message.channel);
		return true;
	});

	messaging.addCommandHandler(/^!voice:join/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length <= 1) {
			return;
		}
		var name = content.slice(1).join(' ');
		joinVoiceChannel(_.find(message.channel.server.channels, function(channel) {
			return channel.type === 'voice' && channel.name === name;
		}), message.channel);
		return true;
	});

	messaging.addCommandHandler(/^!voice:play/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length <= 1) {
			return;
		}
		var url = URL.parse(content[1], true);
		var videoId = url.query ? url.query.v: null;

		if(!client.voiceConnection) {
			client.sendMessage(message.channel, 'Dude, I\'m not connected to a voice channel');
		} else if(url.hostname !== 'www.youtube.com' || url.pathname !== '/watch') {
			client.sendMessage(message.channel, 'Your link is broked');
		} else {
			var youtubeUrl = 'https://www.youtube.com/watch?v=' + videoId;
			var stream = ytdl(youtubeUrl, YTDL_OPTIONS);

			stream.on('info', function(info, format) {
				logger.debug('stream info');
				logger.debug(info);
				logger.debug(format);
				client.sendMessage(message.channel, 'Playing **' + info.title + '**');
			});

			stream.on('response', function(response) {
				logger.debug('stream response');
				logger.debug(response);
			});

			client.voiceConnection.playRawStream(stream, {volume: 0.5})
			.then(function(intent) {
				intent.on('end', function() {
					client.sendMessage(message.channel, 'Finished playing');
				});
				intent.on('error', function(e) {
					logger.error(e);
				});
			});
		}
	});

	messaging.addCommandHandler(/^!voice:leave/i, function(message) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		client.leaveVoiceChannel();
		client.sendMessage(message.channel, 'Leaving voice channel');
		return true;
	});

};

