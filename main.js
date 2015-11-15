var _ = require('underscore');
var Discord = require('discord.js');
var request = require('request');
var start = require('./lib/client').start;
var twitter = require('./lib/twitter');
var secrets = require('./secrets');

// Simple GET request that also limite the number of characters to 400
function simpleGET(url, callback) {
	request(url, function(error, response, body) {
		if(error || response.statusCode !== 200) {
			return;
		}
		if(body.length <= 400) {
			callback(body);
		} else {
			callback('Response longer than 400 charcters. Refusing to print.');
		}
	});
}

var handlers = [];
function messageHandler(client, message) {
	console.log(message.author.username, message.channel.name + '(' + message.channel.id + ')', message.content);
	var content = message.content.split(' ');
	_.find(handlers, function(handler) {
		return handler(client, message, content);
	});
}

handlers.push(function(client, message, content) {
	if(content[0] === '!invite' &&
		content[1].indexOf('discord.gg') > -1 &&
		message.channel instanceof Discord.PMChannel) {
		client.joinServer(content[1], function(err, server) {
			if(err) {
				sendMessage(client, message.channel, 'Something went wrong, please contact admins');
			} else {
				sendMessage(client, message.channel, 'Joined successfully');
			}
		});
	}
});

handlers.push(function(client, message, content) {
	if(content[0] === '!trader') {
		simpleGET('http://wf.tcooc.net/trader', function(body) {
			sendMessage(client, message.channel, body);
		});
		return true;
	}
});

handlers.push(function(client, message, content) {
	if(/!deals?/i.test(content[0])) {
		simpleGET('http://wf.tcooc.net/deal', function(body) {
				sendMessage(client, message.channel, body);
		});
		return true;
	}
});

handlers.push(function(client, message, content) {
	if(/!scans?/i.test(content[0])) {
		simpleGET('http://wf.tcooc.net/scan', function(body) {
				sendMessage(client, message.channel, body);
		});
		return true;
	}
});

handlers.push(function(client, message, content) {
	if(content[0] === '!wiki' && content.length > 1) {
		// check if page exists, kinda
		var url = 'https://warframe.wikia.com/wiki/';
		url += _.map(content.slice(1), function(n) {
			return n[0].toUpperCase() + n.substring(1);
		}).join('_');
		request.head(url, function(error, response) {
			if(error || response.statusCode !== 200) {
				return;
			}
			sendMessage(client, message.channel, url);
		});
		return true;
	}
});

handlers.push(function(client, message, content) {
	if(/soon/i.test(content[0])) {
		sendMessage(client, message.channel, 'Soon' + String.fromCharCode(8482));
		return true;
	}
});

handlers.push(function(client, message, content) {
	if(content[0].startsWith('!trialstat')) {
		sendMessage(client, message.channel,
			'Hek: http://tinyurl.com/qb752oj Nightmare: http://tinyurl.com/p8og6xf Jordas: http://tinyurl.com/prpebzh');
		return true;
	}
});

function bindTwitter(client) {
	var acceptRegex = /Mod|Blueprint|Aura|Key/;
	var channels = _.map(secrets.discord_channels, function(id) {
		return client.getChannel('id', id);
	});
	twitter.createStream(secrets.twitter_follow').then(function(stream) {
	        stream.on('data', function(tweet) {
			console.log(tweet);
			if(tweet.user.id_str === secrets.twitter_follow &&
				!tweet.retweeted_status &&
				acceptRegex.test(tweet.text)) {
				_.each(channels, function(channel) {
					sendMessage(client, channel, tweet.text);
				});
			}
	        });
	        stream.on('error', function(error) {
	                throw error;
	        });
	});
}

var startResult = start(messageHandler);
var client = startResult.client;
var sendMessage = startResult.sendMessage;

client.on('ready', bindTwitter.bind(null, client));
client.on('ready', function() {
	console.log('Harmony activated');
});
