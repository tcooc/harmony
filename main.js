require('app-module-path').addPath(__dirname);
var _ = require('underscore');
var winston = require('winston');

var bot = require('lib/bot');
var Messaging = require('lib/Messaging');
var secrets = require('secrets');

var aimlPlugin = require('plugins/aiml');
var debugPlugin = require('plugins/debug');
var discordPlugin = require('plugins/discord');
var funPlugin = require('plugins/fun');
var twitterPlugin = require('plugins/twitter')(secrets.twitterFollow, secrets.twitterBroadcasts);
var voicePlugin = require('plugins/voice');
var warframePlugin = require('plugins/warframe');

winston.level = secrets.logLevel;

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
	winston.info('Harmony activated');
});

var messaging = new Messaging(client, {
	owner: secrets.owner,
	prefix: secrets.prefix,
	twitter: secrets.twitter
});
_.each([
	debugPlugin, discordPlugin, funPlugin, twitterPlugin.link, warframePlugin, voicePlugin, aimlPlugin
], function(plugin) {
	messaging.addPlugin(plugin);
});

client.login(secrets.email, secrets.password);

function shutdown() {
	winston.info('Shutting down');
	if(twitterPlugin.stream) {
		twitterPlugin.stream.destroy();
	}
	client.logout().then(function() {
		process.exit(0);
	});
}

process.on('SIGINT', shutdown);

process.on('uncaughtException', function(error) {
	winston.error(error);
	process.exit(1);
});
