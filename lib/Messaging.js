var _ = require('underscore');

function Messaging(client, settings) {
	this.client = client;
	this.settings = settings;
	this.hooks = [];
	this.handlers = [];
}

function passInCommand(regex, handler) {
	var messaging = this;
	return function(message) {
		var content = message.content;
		var prefix = messaging.getPrefix(message.server);
		if(content.startsWith(prefix)) {
			content = content.substring(prefix.length).trim();
		}
		if(regex.test(content)) {
			return handler(message, content.split(' '));
		}
		return false;
	};
}

Messaging.prototype.getPrefix = function(server) {
	return this.settings.prefix[server.id] || this.settings.prefix.default;
};

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
