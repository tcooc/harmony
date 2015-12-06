require('app-module-path').addPath(__dirname);
var _ = require('underscore');
var logger = require('logger');

var bot = require('lib/bot');
var db = require('db');
var Messaging = require('lib/Messaging');

var settings = db('settings').first();

var aimlPlugin = require('plugins/aiml');
var debugPlugin = require('plugins/debug');
var discordPlugin = require('plugins/discord');
var foodPlugin = require('plugins/food')(settings.foodUrl);
var funPlugin = require('plugins/fun');
var helpPlugin = require('plugins/help');
var twitterPlugin = require('plugins/twitter')(settings.twitterFollow, db('twitterBroadcasts'));
var voicePlugin = require('plugins/voice');
var warframePlugin = require('plugins/warframe');

logger.transports.console.level = settings.logLevel;

var client = bot.create();

client.on('message', function(message) {
	if(message.author.id === client.user.id) {
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

var messaging = new Messaging(client, {
	owner: settings.owner,
	prefix: db('prefix'),
	defaultPrefix: {prefix: '@<me>'},
	twitter: settings.twitter
});
_.each([
	debugPlugin, discordPlugin, foodPlugin, funPlugin, helpPlugin,
	twitterPlugin.link, warframePlugin, voicePlugin, aimlPlugin
], function(plugin) {
	messaging.addPlugin(plugin);
});

client.login(settings.email, settings.password);

function shutdown() {
	logger.info('Shutting down');
	if(twitterPlugin.stream) {
		twitterPlugin.stream.destroy();
	}
	client.logout().then(function() {
		process.exit(0);
	});
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
