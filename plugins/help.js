var commands = [
	'!commands', 'Shows this message',
	'!about', 'About me',
	'!trader', 'Void trader info',
	'!scans', 'Scan target info',
	'!deals', 'Darvo deals',
	'!invasion', 'List invasions and rewards',
	'!sortie', 'Sortie info',
	'!wiki', 'Get wiki link for the specified topic. For example, `!wiki excalibur`',
	'!trialstats', 'Get links to trial stats',
	'!alertme', 'Personalized alert notifications. Type `!alertme` to see instructions',
	'!invite', 'PM me `!invite <Discord invite url>` to invite me to your server',
	'!prefix', 'Set the required to activate me for your server. Only works if you are the owner.' +
		'`!prefix @<me>` sets it to mentions, and `!prefix <none>` disables the prefix',
	'!food', 'Stare at random images of food',
	'!flip', 'Flip your table',
	'!unflip', 'Unflip your table',
	'soon', '(coming soon)'
];

function generateHelpMessage() {
	var message = [];
	for(var i = 0; i < commands.length; i += 2) {
		message.push('**' + commands[i] + '** - ' + commands[i + 1]);
	}
	return message.join('\n');
}

module.exports = function(messaging, client) {
	messaging.addCommandHandler(/^!about?/i, function(message) {
		client.sendMessage(message.author, 'I am a bot created by tcooc for Warframe related matters.\n' +
			'Type `!commands` to see what I can do.\n' +
			'Feel free to PM my creator if you have any feedback.');
		return true;
	});

	messaging.addCommandHandler(/^!commands?/i, function(message) {
		client.sendMessage(message.author, generateHelpMessage());
		return true;
	});
};
