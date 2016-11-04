var _ = require('underscore');
var logger = require('logger');
var db = require('db');

function MessageSender(options) {
	_.extend(this, {interval: 1000, backlog: 100}, options);
	this.queue = [];
	this.queueInterval = null;
}

MessageSender.prototype.popQueue = function() {
	if(this.queue.length === 0) {
		clearInterval(this.queueInterval);
		this.queueInterval = null;
	} else {
		var payload = this.queue.shift();
		payload.channel.sendMessage.apply(payload.channel, payload.args).then(payload.dfd.resolve, payload.dfd.reject);
	}
};

MessageSender.prototype.send = function(channel, ...args) {
	var dfd = Promise.defer();
	if(channel.channel) {
		channel = channel.channel;
	}
	if(this.queue.length <= this.backlog) {
		this.queue.push({channel: channel, args: args, dfd: dfd});
	} else {
		logger.warn('too many messages queued, discarding');
	}
	if(!this.queueInterval) {
		this.queueInterval = setInterval(() => this.popQueue(), this.interval);
	}
	return dfd.promise;
};

function Messaging(client, settings) {
	this.client = client;
	this.settings = settings;

	this.sender = new MessageSender();
	this.send = this.sender.send.bind(this.sender);

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
	if(message.guild) {
		prefix = (db._data.prefix[message.guild.id] || prefix);
	}
	if(prefix === '@<me>') {
		prefix = this.client.user.toString();
	}
	return prefix;
};

Messaging.prototype.setPrefix = function(message, prefix) {
	if(message.guild) {
		db.update(function(data) {
			if(typeof prefix !== 'string' || prefix.length === 0) {
				delete data.prefix[message.guild.id];
			} else {
				data.prefix[message.guild.id] = prefix;
			}
		});
		return true;
	}
	return false;
};

Messaging.prototype.isOwner = function(user, guild) {
	if(guild) {
		return user.id === guild.owner.id;
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
	if(message.guild) {
		logger.silly('Prefix for server ' + message.guild.id + ' is ' + this.getPrefix(message));
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
	}).catch(function(e) {
		logger.error(e);
	});
};

Messaging.prototype.broadcast = function(channels, content) {
	return Promise.all(_.map(channels, function(channel) {
		return this.send(channel, content);
	}.bind(this)));
};

Messaging.prototype.stop = function() {
	_.each(this.cleanups, function(cleanup) {
		cleanup();
	});
};

module.exports = Messaging;
