var bot = require('./lib/bot');
var Messaging = require('./lib/Messaging');
var secrets = require('./secrets');

var aimlPlugin = require('./plugins/aiml');
var debugPlugin = require('./plugins/debug');
var discordPlugin = require('./plugins/discord');
var funPlugin = require('./plugins/fun');
var twitterPlugin = require('./plugins/twitter')(secrets.twitterFollow, secrets.twitterBroadcasts);
var voicePlugin = require('./plugins/voice');
var warframePlugin = require('./plugins/warframe');

var client = bot.create(500, 100);
var messaging = new Messaging(client, {owner: secrets.owner, twitter: secrets.twitter});

messaging.addPlugin(debugPlugin);
messaging.addPlugin(discordPlugin);
messaging.addPlugin(funPlugin);
messaging.addPlugin(twitterPlugin);
messaging.addPlugin(warframePlugin);
messaging.addPlugin(voicePlugin);
messaging.addPlugin(aimlPlugin);

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
	console.error(error);
	throw new Error('discord client error');
});

client.login(secrets.email, secrets.password);

client.on('ready', function() {
	console.log('Harmony activated');
});
