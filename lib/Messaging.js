var _ = require('underscore');

function Messaging(client) {
	this.client = client;
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
	plugin(this);
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

module.exports = Messaging;