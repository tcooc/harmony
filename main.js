require('app-module-path').addPath(__dirname);
const _ = require('underscore');
const Discord = require('discord.js');
const logger = require('logger');
const db = require('db');
const Messaging = require('lib/Messaging');

const plugins = [
	'd3', 'debug', 'discord', 'food', 'fun', 'twitch', 'twitter', 'warframe', 'voice', 'command', 'help'
].map((name) => 'plugins/' + name);

const client = new Discord.Client();
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
	messaging = new Messaging(client, _.extend({}, settings));
	logger.transports.console.level = settings.logLevel;
	plugins.map((plugin) => require(plugin)).forEach(function(plugin) {
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

process.on('unhandledRejection', (reason, p) => {
	logger.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
