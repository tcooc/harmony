require('app-module-path').addPath(__dirname);
const startup = require('startup');
const plugins = [
	'd3', 'debug', 'discord', 'food', 'fun', 'twitch', 'twitter', 'warframe', 'minecraft', 'voice', 'command', 'help'
].map((name) => 'plugins/' + name);

startup(plugins, (settings) => [settings.discord.token]);
