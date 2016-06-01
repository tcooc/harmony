require('app-module-path').addPath(__dirname);
var _ = require('underscore');
var logger = require('logger');

var bot = require('lib/bot');
var db = require('db');
var Messaging = require('lib/Messaging');

var settings = db('settings').first();

var d3Plugin = require('plugins/d3');
var debugPlugin = require('plugins/debug');
var discordPlugin = require('plugins/discord');
var foodPlugin = require('plugins/food')(settings.foodUrl);
var funPlugin = require('plugins/fun');
var helpPlugin = require('plugins/help');
var twitchPlugin = require('plugins/twitch');
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
	db: db,
	owner: settings.owner,
	prefix: db('prefix'),
	defaultPrefix: {prefix: ''},
	alertBroadcasts: db('twitterBroadcasts'),
	twitter: settings.twitter,
	twitch: db('twitch'),
	google: settings.google,
	emotes: db('emotes').value()
});
_.each([
	d3Plugin, debugPlugin, discordPlugin, foodPlugin, funPlugin, helpPlugin, twitchPlugin,
	twitterPlugin.link, warframePlugin, voicePlugin
], function(plugin) {
	messaging.addPlugin(plugin);
});

client.login(settings.email, settings.password);

function shutdown() {
	var exit = process.exit.bind(process, 0);
	logger.info('Shutting down');
	if(twitterPlugin.stream) {
		twitterPlugin.stream.stop();
	}
	client.logout().then(exit, exit);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
