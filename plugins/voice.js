var AudioManager = require('lib/audio').AudioManager;

module.exports = function(messaging, client) {
	var audioManager = new AudioManager(client);

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
					client.sendMessage(message.channel, 'Dude, I\'m not connected to a voice channel');
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
				var success = audioManager.play(message.channel, urlString, {volume: 0.2});
				if(success && audioManager.queue.length > 0) {
					client.sendMessage(message.channel, 'Added to queue');
				} else if (!success) {
					client.sendMessage(message.channel, 'Your link is broken');
				}
			});
		}
		return true;
	});

	messaging.addCommandHandler(/^!audio:stop/i, function(message) {
		if(!client.voiceConnection) {
			client.sendMessage(message.channel, 'Not playing anything');
		} else {
			audioManager.stop();
			client.sendMessage(message.channel, 'Stopping');
		}
		return true;
	});

	messaging.addCommandHandler(/^!audio:leave/i, function(message) {
		audioManager.stop();
		client.leaveVoiceChannel();
		client.sendMessage(messaging.channel, 'Leaving voice channel');
		return true;
	});

	messaging.addCommandHandler(/^!veto/i, function(message) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		audioManager.queue.pop();
		client.sendMessage(messaging.channel, 'VETOED');
		return true;
	});
};
