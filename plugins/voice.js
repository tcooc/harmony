var _ = require('underscore');
var URL = require('url');
var ytdl = require('ytdl-core');

var YTDL_OPTIONS = {
	quality: 'lowest',
	filter: function(format) {
		return format.container === 'mp4';
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
		var name = content[1];
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

			client.voiceConnection.playRawStream(stream)
			.then(function(intent) {
				intent.once('time', function() {
					client.sendMessage(message.channel, 'Playing...');
				});
				intent.on('end', function() {
					client.sendMessage(message.channel, 'Finished playing');
				});
				intent.on('error', function(e) {
					console.error(e);
				});
			})
			.catch(function(err) {
				console.error('failed to fetch file', err);
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

