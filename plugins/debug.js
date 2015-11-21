var Promise = require('bluebird');
var exec = Promise.promisify(require('child_process').exec, {multiArgs: true});
var fs = Promise.promisifyAll(require('fs'));
var URL = require('url');

module.exports = function(owner) {
	return function(messaging) {
		messaging.addHook(function(message) {
			console.log(message.author.username + '(' + message.author.id + ')',
				message.channel.name + '(' + message.channel.id + ')',
				message.content);
		});

		messaging.addCommandHandler(/^!eval/i, function(message, content) {
			if(message.author.id !== owner || content.length <= 1) {
				return;
			}
			try {
				var result = eval(content.slice(1).join(' ')); // jshint ignore:line
				console.log(result);
				messaging.client.sendMessage(message.channel, result);
			} catch(e) {
				messaging.client.sendMessage(message.channel, '```'+ e.stack + '```');
			}
			return true;
		});

		messaging.addCommandHandler(/^!stats/i, function(message, content) {
			if(message.author.id !== owner) {
				return;
			}
			var servers = messaging.client.servers.length;
			var users = messaging.client.users.length;
			messaging.client.sendMessage(message.channel, 'Connected to ' + servers + ' servers with a total of ' + users + ' users.');
			return true;
		});

		messaging.addCommandHandler(/^!voice:join/i, function(message, content) {
			if(message.author.id !== owner) {
				return;
			}
			var channel = messaging.client.channels.get('id', content[1]);
			messaging.client.joinVoiceChannel(channel);
			messaging.client.sendMessage(message.channel, 'Joining ' + channel);
			return true;
		});

		messaging.addCommandHandler(/^!voice:play/i, function(message, content) {
			if(message.author.id !== owner || content.length <= 1) {
				return;
			}
			var url = URL.parse(content[1], true);
			var videoId = url.query ? url.query.v: null;
			if(!messaging.client.voiceConnection) {
				messaging.client.sendMessage(message.channel, 'Dude, I\'m not connected to a voice channel');
			} else if(url.hostname !== 'www.youtube.com' || url.pathname !== '/watch') {
				messaging.client.sendMessage(message.channel, 'Your link is broked');
			} else {
				var youtubeUrl = 'https://www.youtube.com/watch?v=' + videoId;
				var output = '/www/.temp/' + videoId;

				messaging.client.sendMessage(message.channel, 'Playing video');

				exec('youtube-dl \'' + youtubeUrl +'\' --max-filesize 50m -f worst -w -o ' + output)
				.then(function(stdout, stderr) {
					return messaging.client.voiceConnection.playFile(output);
				})
				.then(function(event) {
					console.log(event, arguments);
				})
				.catch(function(err) {
					console.error('failed to fetch file', err);
				});
			}
		});

		messaging.addCommandHandler(/^!voice:leave/i, function(message, content) {
			if(message.author.id !== owner) {
				return;
			}
			messaging.client.leaveVoiceChannel();
			messaging.client.sendMessage(message.channel, 'Leaving voice channel');
			return true;
		});

	};
};
