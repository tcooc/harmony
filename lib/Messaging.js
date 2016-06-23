var _ = require('underscore');
var logger = require('logger');

function Messaging(client, settings) {
	this.client = client;
	this.settings = settings;
	this.hooks = [];
	this.postHooks = [];
	this.handlers = [];
}

function passInCommand(messaging, regex, handler) {
	return function(message) {
		var content = message.content;
		var prefix = messaging.getPrefix(message);
		if(prefix) {
			if(content.startsWith(prefix)) {
				content = content.substring(prefix.length).trim();
			} else {
				return false;
			}
		}
		if(regex.test(content)) {
			return handler(message, content.split(' '));
		}
		return false;
	};
}

Messaging.prototype.getPrefix = function(message) {
	var prefix = this.settings.defaultPrefix.prefix;
	if(message.channel.server) {
		prefix = (this.settings.prefix.find({server: message.channel.server.id}) || this.settings.defaultPrefix).prefix;
	}
	if(prefix === '@<me>') {
		prefix = this.client.user.toString();
	}
	return prefix;
};

Messaging.prototype.setPrefix = function(message, prefix) {
	if(message.channel.server) {
		var newPrefix = {
			server: message.channel.server.id,
			prefix: prefix
		};
		if(this.settings.prefix.find({server: message.channel.server.id})) {
			this.settings.prefix.chain().find({server: message.channel.server.id}).assign(newPrefix).value();
		} else {
			this.settings.prefix.push(newPrefix);
		}
		return true;
	}
	return false;
};

Messaging.prototype.isOwner = function(user, server) {
	if(server) {
		return user.id === server.owner.id;
	}
	return false;
};

Messaging.prototype.addPlugin = function(plugin) {
	plugin(this, this.client);
};

Messaging.prototype.addHandler = function(handler) {
	this.handlers.push(handler);
};

Messaging.prototype.addCommandHandler = function(regex, handler) {
	this.handlers.push(passInCommand(this, regex, handler));
};

Messaging.prototype.addHook = function(hook) {
	this.hooks.push(hook);
};

Messaging.prototype.addPostHook = function(hook) {
	this.postHooks.push(hook);
};

// processor logic deals with hooks, handlers, and postHooks
// hooks are executed first
// handlers are executed next until one returns true, or all handlers have been executed
// postHooks are then executed, with the message and the "handled" parameter
Messaging.prototype.process = function(message) {
	if(message.channel.server) {
		logger.debug('Prefix for server ' + message.channel.server.id + ' is ' + this.getPrefix(message));
	}
	_.each(this.hooks, function(hook) {
		hook(message);
	});
	var handled = !!_.find(this.handlers, function(handler) {
		return handler(message);
	});
	_.find(this.postHooks, function(hook) {
		hook(message, handled);
	});
};

Messaging.prototype.broadcast = function(channels, content) {
	return Promise.all(_.map(channels, function(channel) {
		return this.client.sendMessage(channel, content);
	}.bind(this)));
};

module.exports = Messaging;
