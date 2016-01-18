module.exports = function(messaging, client) {
	messaging.addCommandHandler(/^!d3gem/i, function(message, content) {
		if(content.length !== 2) {
			return;
		}
		var level = parseInt(content[1]);
		if(isFinite(level)) {
			client.sendMessage(message.channel, 'Gem Level = ' + level + '\n' +
				'Tier for guranteed +3: ' + (level + 13) + '\n' +
				'Tier for guraranteed empower (+4):  ' + (level + 14));
		}
		return true;
	});

};

