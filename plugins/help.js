const Discord = require('discord.js');
const logger = require('logger');

const commandTopicOrder = ['Core', 'Warframe', 'Custom Commands', 'Audio', 'Other'];

const commandSpecs = {
	'/^!d3gem/i': ['!d3gem <gemlevel>', 'Other', 'Diablo 3: Show helpful info on levelling legendary gems'],
	'/^!eval/i': false,
	'/^!run/i': ['!run <code>', 'Other', 'Run some quick javascript code'],
	'/^!message:channel/i': false,
	'/^!message:user/i': false,
	'/^!stats/i': false,
	'/^!reload/i': false,
	'/^!loglevel/i': false,
	'/^!clear/i': false,
	'/^!prefix/i': ['!prefix <prefix>', 'Core',
		'Set the required to activate me for your server. `!prefix @<me>` sets it to mentions, and `!prefix <none>` disables the prefix'],
	'/^!invite/i': ['!invite', 'Core', 'Invite me to your server'],
	'/^!food/i': ['!food', 'Other', 'Stare at random images of food'],
	'/^soon/i': ['soon', 'Other', '(this command is a work in progress)'],
	'/^!unflip/i': ['!unflip', 'Other', 'Unflip your table'],
	'/^!flip/i': ['!flip', 'Other', 'Flip your table'],
	'/^!alertme/i': ['!alertme <space separated list of alert items>', 'Warframe',
		'Personalized alert notifications. i.e. `!alertme Reactor Catalyst Forma Nitain`'],
	'/^!wiki/i': ['!wiki', 'Warframe', 'Get wiki link for the specified topic. For example, `!wiki excalibur`'],
	'/^!warframe:news/i': ['!warframe:news <lang>', 'Warframe',
		'Subscribe to PC news. `!warframe:news en` for English news. `!warframe:news` to cancel notifications'],
	'/^!audio:play/i': ['!audio:play <link>', 'Audio',
		'Play YouTube video/playlist or Twitch stream. The bot will automatically join your current voice channel. ' +
		'If the bot is already playing something it will add your link to the queue.'],
	'/^!audio:loop/i': ['!audio:loop <loop(yes/no)> <shuffle(yes/no)>', 'Audio', 'Set looping and shuffling'],
	'/^!audio:next/i': ['!audio:next', 'Audio', 'Skip currently playing'],
	'/^!audio:remove/i': ['!audio:remove <link>', 'Audio', 'Remove link from queue'],
	'/^!audio:clear/i': ['!audio:clear', 'Audio', 'Clear playlist and currently playing'],
	'/^!audio:leave/i': ['!audio:leave', 'Audio', 'Bot will leave voice channel'],
	'/^!shodan/i': false,
	'/^!custom:add/i': ['!custom:add <command> <message>', 'Custom Commands',
		'Add command from server.' +
		'Special syntax allows for {<number>} to print arguments, {user} to print sender, and {api <url>} to make an API request'],
	'/^!custom:remove/i': ['!custom:remove <command>', 'Custom Commands', 'Remove command from server'],
	'/^!custom:list/i': ['!custom:list', 'Custom Commands', 'List custom commands for server'],
	'/^!custom:source/i': ['!custom:source <command>', 'Custom Commands', 'See command source for command'],
	'/.*/': false,
	'/^!commands?/i': ['!commands', 'Core', 'Shows this message'],
	'/^!feedback/i': ['!feedback', 'Core', 'Send me feedback.'],
	'/^(!|\\/)?(command)|(help)|(about)/i': false,
	'/^!avatar/i': false,
	'/^!username/i': false,
	'/^!mcstatus/i': ['!mcstatus <server>', 'Other', 'Minecraft: Check server status'],
	'/^!price/i': ['!price <item name>', 'Warframe', 'Price check'],
	'/^!twitch/i': ['!twitch <twitch username>', 'Announce when user is streaming']
};

const customCommandSpecs = [
	['!trader', 'Warframe', 'Void trader info'],
	['!void',  'Warframe', 'Void fissure status'],
	['!cetus', 'Warframe', 'Cetus time and bounty rotations'],
	['!deal', 'Warframe', 'Darvo deals'],
	['!scan', 'Warframe' , 'Scan target info'],
	['!sortie', 'Warframe', 'Sortie info'],
	['!invasion', 'Warframe', 'List invasions and rewards'],
	['!trialstat', 'Warframe', 'Get links to trial stats']
];

const aboutMessage = 'Hi, I\'m Harmony.\n' +
	'I am a bot created by `tcooc` for Warframe related matters.\n' +
	'`!invite` to invite me to your server.\n' +
	'`!commands` to see what I can do.\n' +
	'Source code is at https://github.com/tcooc/harmony. Feel free to use `!feedback` to send me feedback.';

module.exports = function(messaging, client) {
	var helpMessage;

	messaging.addCommandHandler(/^!commands?/i, function(message) {
		messaging.send(message.author, aboutMessage);
		messaging.send(message.author, helpMessage);
		return true;
	});

	messaging.addCommandHandler(/^(!|\/)?(command)|(help)|(about)/i, function(message) {
		if(message.channel instanceof Discord.DMChannel) {
			messaging.send(message.author, aboutMessage);
			messaging.send(message.author, helpMessage);
			return true;
		}
		return false;
	});

	messaging.addCommandHandler(/^!feedback/i, function(message) {
		messaging.send(client.users.get(messaging.settings.owner),
			'Feedback: `' + message.content + '` from ' + message.author.username + '(' + message.author.id + ')');
		messaging.send(message.author, 'Thank you for the feedback!');
		return true;
	});

	messaging.addPostHook(function(message, handled) {
		if(!handled && message.channel instanceof Discord.DMChannel) {
			messaging.send(message.author, aboutMessage);
		}
	});

	client.on('ready', function() {
		var commands = messaging.handlers.map((handler) => handler.regex.toString());
		var allSpecs = [];
		var topics = {};
		var message = [];
		// aggregate command specs
		allSpecs = allSpecs.concat(customCommandSpecs);
		commands.forEach(function(command) {
			var spec = commandSpecs[command];
			if(spec) {
				allSpecs.push(spec);
			} else if(spec !== false) {
				logger.warn('Help spec not found for command ' + command);
			}
		});
		// sort into topics
		allSpecs.forEach((spec) => {
			if(!topics[spec[1]]) {
				topics[spec[1]] = [];
			}
			topics[spec[1]].push(spec[0] + ' - ' + spec[2]);
		});
		// combine
		commandTopicOrder.forEach((topicName) => {
			var topic = topics[topicName];
			topic.sort();
			message.push('**' + topicName + '**');
			message = message.concat(topic);
		});
		helpMessage = message.join('\n');
	});
};
