var _ = require('underscore');
var logger = require('logger');
var db = require('db');

function Messaging(client, settings) {
	this.client = client;
	this.settings = settings;
	this.hooks = [];
	this.postHooks = [];
	this.handlers = [];
	this.cleanups = [];
}

function passInCommand(messaging, regex, handler) {
	return function(message) {
		var content = message.content;
		var prefix = messaging.getPrefix(message);
		if(prefix) {
			if(content.toUpperCase().startsWith(prefix.toUpperCase())) {
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
	var prefix = '';
	if(message.channel.server) {
		prefix = (db._data.prefix[message.channel.server.id] || prefix);
	}
	if(prefix === '@<me>') {
		prefix = this.client.user.toString();
	}
	return prefix;
};

Messaging.prototype.setPrefix = function(message, prefix) {
	if(message.channel.server) {
		db.update(function(data) {
			if(typeof prefix !== 'string' || prefix.length === 0) {
				delete data.prefix[message.channel.server.id];
			} else {
				data.prefix[message.channel.server.id] = prefix;
			}
		});
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

Messaging.prototype.addCleanup = function(cleanup) {
	this.cleanups.push(cleanup);
};

// processor logic deals with hooks, handlers, and postHooks
// hooks are executed first
// handlers are executed next until one returns true, or all handlers have been executed
// postHooks are then executed, with the message and the "handled" parameter
Messaging.prototype.process = function(message) {
	if(message.channel.server) {
		logger.silly('Prefix for server ' + message.channel.server.id + ' is ' + this.getPrefix(message));
	}
	_.each(this.hooks, function(hook) {
		hook(message);
	});
	var handled = _.reduce(this.handlers, function(memo, handler) {
		return memo.then(function(handled) {
			if(handled) {
				return true;
			}
			return handler(message);
		});
	}, Promise.resolve(false));
	handled.then((handled) => {
		_.each(this.postHooks, function(hook) {
			hook(message, handled);
		});
	});
};

Messaging.prototype.broadcast = function(channels, content) {
	return Promise.all(_.map(channels, function(channel) {
		return this.client.sendMessage(channel, content);
	}.bind(this)));
};

Messaging.prototype.stop = function() {
	_.each(this.cleanups, function(cleanup) {
		cleanup();
	});
};

module.exports = Messaging;
