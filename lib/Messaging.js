var _ = require('underscore');

function Messaging(client, settings) {
	this.client = client;
	this.settings = settings;
	this.hooks = [];
	this.handlers = [];
}

function passInCommand(regex, handler) {
	return function(message) {
		if(regex.test(message.content)) {
			var content = message.content.split(' ');
			return handler(message, content);
		}
		return false;
	};
}

Messaging.prototype.addPlugin = function(plugin) {
	plugin(this, this.client);
};

Messaging.prototype.addHandler = function(handler) {
	this.handlers.push(handler);
};

Messaging.prototype.addCommandHandler = function(regex, handler) {
	this.handlers.push(passInCommand(regex, handler));
};

Messaging.prototype.addHook = function(hook) {
	this.hooks.push(hook);
};

Messaging.prototype.process = function(message) {
	_.each(this.hooks, function(hook) {
		hook(message);
	});
	_.find(this.handlers, function(handler) {
		return handler(message);
	});
};

Messaging.prototype.broadcast = function(channels, content) {
	return Promise.all(_.map(channels, function(channel) {
		return this.client.sendMessage(channel, content);
	}.bind(this)));
};

module.exports = Messaging;
