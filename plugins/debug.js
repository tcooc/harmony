var Promise = require('bluebird');
var exec = Promise.promisify(require('child_process').exec, {multiArgs: true});
var fs = Promise.promisifyAll(require('fs'));
var URL = require('url');
var vm = require('vm');

module.exports = function(owner) {
	return function(messaging, client) {
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
				client.sendMessage(message.channel, result);
			} catch(e) {
				client.sendMessage(message.channel, '```'+ e.stack + '```');
			}
			return true;
		});

		messaging.addCommandHandler(/^!run/i, function(message, content) {
			if(message.author.id !== owner || content.length <= 1) {
				return;
			}
			setTimeout(function() {
				var result;
				try {
					result = vm.runInNewContext(content.slice(1).join(' '), {}, {timeout: 1000, filename: 'run'});
				} catch(e) {
					console.log(e.stack);
					if(!(e instanceof SyntaxError)) {
						var stack = e.stack.split('\n');
						// if run in a new context, the stack only goes 4 levels deep
						stack.splice(stack.length - 4);
						result = stack.join('\n');
					} else {
						result = e.toString();
					}
					result = '```'+ result + '```';
				}
				client.sendMessage(message.channel, result);
			}, 0);
			return true;
		});

		messaging.addCommandHandler(/^!stats/i, function(message, content) {
			if(message.author.id !== owner) {
				return;
			}
			var servers = client.servers.length;
			var users = client.users.length;
			client.sendMessage(message.channel, 'Connected to ' + servers + ' servers with a total of ' + users + ' users.');
			return true;
		});

		messaging.addCommandHandler(/^!voice:join/i, function(message, content) {
			if(message.author.id !== owner) {
				return;
			}
			var channel = client.channels.get('id', content[1]);
			client.joinVoiceChannel(channel);
			client.sendMessage(message.channel, 'Joining ' + channel);
			return true;
		});

		messaging.addCommandHandler(/^!voice:play/i, function(message, content) {
			if(message.author.id !== owner || content.length <= 1) {
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
				var output = '/www/.temp/' + videoId;

				exec('youtube-dl \'' + youtubeUrl +'\' --max-filesize 50m -f bestaudio/mp4 -w -o ' + output)
				.then(function(stdout, stderr) {
					return null; //exec('ffmpeg -i ' + output + ' -f s16le -ar 48000 -ac 1 -af volume=1 ' + output + '.out');
				})
				.then(function() {
					client.sendMessage(message.channel, 'Playing...');
					return client.voiceConnection.playFile(output);
				})
				.then(function(intent) {
					intent.once('time', function(t) {
						console.log('starting ' + t);
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

		messaging.addCommandHandler(/^!voice:leave/i, function(message, content) {
			if(message.author.id !== owner) {
				return;
			}
			client.leaveVoiceChannel();
			client.sendMessage(message.channel, 'Leaving voice channel');
			return true;
		});

	};
};
