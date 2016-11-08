const Discord = require('discord.js');
const logger = require('logger');

const commandSpecs = {
	'/^!d3gem/i': ['!d3gem <gemlevel>', 'Diablo 3: Show helpful info on levelling legendary gems'],
	'/^!eval/i': false,
	'/^!run/i': ['!run <code>', 'Run some quick javascript code'],
	'/^!message:channel/i': false,
	'/^!message:user/i': false,
	'/^!stats/i': false,
	'/^!reload/i': false,
	'/^!loglevel/i': false,
	'/^!clear/i': false,
	'/^!prefix/i': ['!prefix <prefix>',
		'Set the required to activate me for your server. `!prefix @<me>` sets it to mentions, and `!prefix <none>` disables the prefix'],
	'/^!invite/i': ['!invite <invite url>', 'Invite me to your server'],
	'/^!food/i': ['!food', 'Stare at random images of food'],
	'/^soon/i': ['soon', '(this command is a work in progress)'],
	'/^!unflip/i': ['!unflip', 'Unflip your table'],
	'/^!flip/i': ['!flip', 'Flip your table'],
	'/^!ready/i': ['!ready', 'Ready your body'],
	'/^!alertme:info/i': ['!alertme:info', 'Warframe: Show your alert notifications'],
	'/^!alertme:stop/i': ['!alertme:stop', 'Warframe: Cancel your alert notifications'],
	'/^!alertme/i': ['!alertme <space separated list of alert items>',
		'Warframe: Personalized alert notifications. i.e. `!alertme Reactor Catalyst Forma Nitain`'],
	'/^!trader/i': ['!trader', 'Warframe: Void trader info'],
	'/^!deals?/i': ['!deals', 'Warframe: Darvo deals'],
	'/^!scans?/i': ['!scans', 'Warframe: Scan target info'],
	'/^!sorties?/i': ['!sortie', 'Warframe: Sortie info'],
	'/^!invasions?/i': ['!invasion', 'Warframe: List invasions and rewards'],
	'/^!sheev/i': false,
	'/^!wiki/i': ['!wiki', 'Warframe: Get wiki link for the specified topic. For example, `!wiki excalibur`'],
	'/^!trialstats?/i': ['!trialstats', 'Warframe: Get links to trial stats'],
	'/^!warframe:news/i': ['!warframe:news <lang>',
		'Warframe: Subscribe to PC news. `!warframe:news en` for English news. `!warframe:news` to cancel notifications'],
	'/^!audio:play/i': false,
	'/^!audio:loop/i': false,
	'/^!audio:next/i': false,
	'/^!audio:remove/i': false,
	'/^!audio:clear/i': false,
	'/^!audio:leave/i': false,
	'/^!shodan/i': false,
	'/^!custom:add/i': ['!custom:add <command> <message>',
		'Add command from server.' +
		'Special syntax allows for {<number>} to print arguments, {user} to print sender, and {api <url>} to make an API request'],
	'/^!custom:remove/i': ['!custom:remove <command>', 'Remove command from server'],
	'/^!custom:list/i': ['!custom:list', 'List custom commands for server'],
	'/.*/': false,
	'/^!commands?/i': ['!commands', 'Shows this message'],
	'/^!feedback/i': ['!feedback', 'Send me feedback.'],
	'/^(!|\\/)?(command)|(help)|(about)/i': false
};

const aboutMessage = 'Hi, I\'m Harmony.\n' +
	'I am a bot created by `tcooc` for Warframe related matters.\n' +
	'`!invite <invite url>` to invite me to your server.\n' +
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
		messaging.send(client.users.find('id', messaging.settings.owner),
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
		commands.sort();
		var message = [];
		commands.forEach(function(command) {
			var spec = commandSpecs[command];
			if(spec) {
				message.push('**' + spec[0] + '** - ' + spec[1]);
			} else if(spec !== false) {
				logger.warn('Help spec not found for command ' + command);
			}
		});
		helpMessage = message.join('\n');
	});
};
