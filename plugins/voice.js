var AudioManager = require('lib/audio').AudioManager;

module.exports = function(messaging, client) {
	var audioManager = new AudioManager(client);

	messaging.addCommandHandler(/^!audio:play/i, function(message, content) {
		if(message.author.id !== messaging.settings.owner || content.length <= 1) {
			return;
		}

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
			audioManager.play(message.channel, urlString, {volume: 0.2});
		});
		return true;
	});

	messaging.addCommandHandler(/^!audio:start/i, function(message) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		audioManager.start();
		return true;
	});

	messaging.addCommandHandler(/^!audio:stop/i, function(message) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		if(!client.voiceConnection) {
			client.sendMessage(message.channel, 'Not playing anything');
		} else {
			audioManager.stop();
			client.sendMessage(message.channel, 'Stopping');
		}
		return true;
	});

	messaging.addCommandHandler(/^!audio:leave/i, function(message) {
		if(message.author.id !== messaging.settings.owner) {
			return;
		}
		audioManager.stop();
		client.leaveVoiceChannel();
		client.sendMessage(messaging.channel, 'Leaving voice channel');
		return true;
	});

};
