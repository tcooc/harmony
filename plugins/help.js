var commands = [
	'!commands', 'Shows this message',
	'!about', 'About me',
	'!trader', 'Void trader info',
	'!scans', 'Scan target info',
	'!deals', 'Darvo deals',
	'!wiki', 'Get wiki link for the specified topic. For example, `!wiki excalibur`',
	'!trialstats', 'Get links to trial stats',
	'!alertme', 'Personalized alert notifications. Type `!alertme` to see instructions',
	'!invite', 'PM me `!invite <Discord invite url>` to invite my to your server',
	'!flip', 'Flip your table',
	'!unflip', 'Unflip a table',
	'soon', '(coming soon)'
];

function generateHelpMessage() {
	var message = [];
	for(var i = 0; i < commands.length; i += 2) {
		message.push(commands[i] + ' - ' + commands[i + 1]);
	}
	return message.join('\n');
}

module.exports = function(messaging, client) {
	messaging.addCommandHandler(/^!commands?/i, function(message) {
		client.sendMessage(message.author, generateHelpMessage());
		return true;
	});
};