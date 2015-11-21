var _ = require('underscore');
var Discord = require('discord.js');
var request = require('request');

var bot = require('./lib/bot');
var Messaging = require('./lib/Messaging');
var secrets = require('./secrets');

var debugPlugin = require('./plugins/debug');
var discordPlugin = require('./plugins/discord');
var funPlugin = require('./plugins/fun');
var twitterPlugin = require('./plugins/twitter')(secrets.twitter_follow, secrets.discord_channels, /Mod|Blueprint|Aura|Key/);
var warframePlugin = require('./plugins/warframe');

var client = bot.create(500, 100);
var messaging = new Messaging(client);

messaging.addPlugin(debugPlugin);
messaging.addPlugin(discordPlugin);
messaging.addPlugin(funPlugin);
messaging.addPlugin(twitterPlugin);
messaging.addPlugin(warframePlugin);

client.on('message', function(message) {
	if(message.author.username === client.user.username) {
		return;
	}
	messaging.process(message);
});

client.on('disconnected', function() {
	throw new Error('disconnected');
});

client.on('error', function(error) {
	console.error(error);
	throw new Error('discord client error');
});

client.login(secrets.email, secrets.password);

client.on('ready', function() {
	console.log('Harmony activated');
});
