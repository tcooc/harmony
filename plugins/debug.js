module.exports = function(messaging) {
	messaging.addHook(function(message) {
		console.log(message.author.username, message.channel.name + '(' + message.channel.id + ')', message.content);
	});
};
