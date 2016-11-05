require('app-module-path').addPath(__dirname);
var _ = require('underscore');
var Discord = require('discord.js');
var logger = require('logger');

var db = require('db');
var Messaging = require('lib/Messaging');

var commandPlugin = require('plugins/command');
var d3Plugin = require('plugins/d3');
var debugPlugin = require('plugins/debug');
var discordPlugin = require('plugins/discord');
var foodPlugin = require('plugins/food');
var funPlugin = require('plugins/fun');
var helpPlugin = require('plugins/help');
var twitchPlugin = require('plugins/twitch');
var twitterPlugin = require('plugins/twitter');
var voicePlugin = require('plugins/voice');
var warframePlugin = require('plugins/warframe');

process.on('unhandledRejection', (reason, p) => {
	logger.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

var client = new Discord.Client();

var messaging;

client.on('message', function(message) {
	if(message.author.id === client.user.id || message.author.bot) {
		return;
	}
	messaging.process(message);
});

client.on('disconnected', function() {
	throw new Error('disconnected');
});

client.on('error', function(error) {
	throw error;
});

client.on('ready', function() {
	logger.info('Harmony activated');
});

// TODO turn client.users.get into fetchUser
db.get().then(function(data) {
	var settings = data.settings;
	logger.transports.console.level = settings.logLevel;
	messaging = new Messaging(client, _.extend({}, settings));
	_.each([
		d3Plugin, debugPlugin, discordPlugin, foodPlugin, funPlugin, twitchPlugin,
		twitterPlugin, warframePlugin, voicePlugin, commandPlugin, helpPlugin
	], function(plugin) {
		messaging.addPlugin(plugin);
	});
	client.login(settings.email, settings.password);
});


function shutdown() {
	logger.info('Shutting down');
	messaging.stop();
	db.release();
	client.destroy();
	setTimeout(function() {
		process.exit(0);
	}, 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
