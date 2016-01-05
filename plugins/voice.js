var audio = require('lib/audio');

module.exports = function(messaging, client) {
	var audioManager = new audio.AudioManager(messaging);

	audioManager.eventBus.on('playing', function(spec, info) {
		if(info) {
			client.sendMessage(spec.output, 'Playing **' + info.title + '**');
		} else {
			client.sendMessage(spec.output, 'Playing **' + spec.url + '**');
		}
	});

	audioManager.eventBus.on('stopping', function(spec) {
		client.sendMessage(spec.output, 'Finished playing ' + spec.type);
	});

	messaging.addCommandHandler(/^!audio:play/i, function(message, content) {
		if(content.length <= 1) {
			audioManager.start();
		} else {
			var promise;
			if(!client.voiceConnection) {
				if(!message.author.voiceChannel) {
					client.sendMessage(message.channel, 'Dude, you\'re not connected to a voice channel');
					return true;
				}
				promise = client.joinVoiceChannel(message.author.voiceChannel);
			} else {
				promise = Promise.resolve();
			}
			promise.then(function() {
				var urlString = content[1];
				if(urlString.startsWith('www')) {
					urlString = 'http://' + urlString;
				}
				return audioManager.play(message.channel, urlString, {volume: 0.2});
			}).then(function(status) {
				if(status === audio.PlayStatus.Invalid) {
					client.sendMessage(message.channel, 'Your link is broken');
					return;
				}
				if(status === audio.PlayStatus.Playlist) {
					client.sendMessage(message.channel, 'Playlist added');
					return;
				}
				if(status && audioManager.queue.length > 0) {
					client.sendMessage(message.channel, 'Added to queue');
				}
			});
		}
		return true;
	});

	messaging.addCommandHandler(/^!audio:skip/i, function(message) {
		if(!client.voiceConnection) {
			client.sendMessage(message.channel, 'Not playing anything');
		} else {
			audioManager.stop();
		}
		return true;
	});

	messaging.addCommandHandler(/^!audio:leave/i, function(message) {
		audioManager.stop();
		client.leaveVoiceChannel();
		client.sendMessage(messaging.channel, 'Leaving voice channel');
		return true;
	});
};
