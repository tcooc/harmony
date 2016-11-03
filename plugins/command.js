var _ = require('underscore');
var Promise = require('bluebird');
var Discord = require('discord.js');
var db = require('db');
var logger = require('logger');
var request = Promise.promisifyAll(require('request'));

var GLOBAL_COM = '*';

var COMMAND_REGEX = /([^{]*)({([^}]*)})|(.+)/g;
var ARG_REGEX = /^[1-9][0-9]?$/;
var USER_REGEX = /^user$/i;
var API_REGEX = /^api (https?:\/\/[^ ]+)$/i;

module.exports = function(messaging, client) {

	var commandCache = {};

	function refreshCache(id, data, force) {
		if(force || !commandCache[id]) {
			var commands = data.customCommands[id];
			commandCache[id] = _.mapObject(commands, function(response, name) {
				return new CustomCommand(name, response);
			});
		}
	}

	db.get().then(function(data) {
		_.each(data.customCommands, function(value, id) {
			refreshCache(id, data);
		});
	});

	messaging.addCommandHandler(/^!custom:add/i, function(message, args) {
		var id = getCommandsId(message);
		if(id) {
			var name = args[1];
			var response = args.slice(2).join(' ');
			if(!name || !response) {
				client.sendMessage(message.channel, 'Please specify a command and response');
			} else {
				// set server command
				db.update(function(data) {
					var commands = data.customCommands[id] = data.customCommands[id] || {};
					commands[name] = response;
					refreshCache(id, data, true);
				});
				client.sendMessage(message.channel, name + ' created');
			}
		} else {
			client.sendMessage(message.channel, 'Only the owner may edit custom commands');
		}
		return true;
	});

	messaging.addCommandHandler(/^!custom:remove/i, function(message, args) {
		var id = getCommandsId(message);
		if(id) {
			var name = args[1];
			if(!name) {
				client.sendMessage(message.channel, 'Please specify a command to delete');
			} else {
				// remove server command
				db.update(function(data) {
					var commands = data.customCommands[id];
					if(commands) {
						delete commands[name];
						refreshCache(id, data, true);
					}
				});
				client.sendMessage(message.channel, name + ' deleted');
			}
		} else {
			client.sendMessage(message.channel, 'Only the owner may edit custom commands');
		}
		return true;
	});

	messaging.addCommandHandler(/^!custom:list/i, function(message) {
		var id = getCommandsId(message, true);
		if(id) {
			var commands = commandCache[id] || {};
			client.sendMessage(message.channel, 'Custom commands:\n`' + Object.keys(commands).join('`, `') + '`');
		} else {
			client.sendMessage(message.channel, 'Use this command in a server to print server commands');
		}
		return true;
	});

	messaging.addCommandHandler(/^!custom/i, function(message) {
		client.sendMessage(message.author, '!custom:list, !custom:add, !custom:remove');
		return true;
	});

	messaging.addCommandHandler(/.*/, function(message, args) {
		var id = getCommandsId(message, true);
		var promise;
		if(id && args.length) {
			if(commandCache[id]) {
				promise = Promise.resolve(commandCache[id]);
			} else {
				promise = db.get().then(function(data) {
					refreshCache(id, data);
					return commandCache[id];
				});
			}
			return promise.then(function(commands) {
				return !!_.find(commands, function(command) {
					return command.process(message);
				});
			});
		}
		return false;
	});

	function getCommandsId(message, readonly) {
		var isGlobal = message.channel instanceof Discord.PMChannel;
		var isOwner = message.author.id === messaging.settings.owner || messaging.isOwner(message.author, message.channel.server);
		var id = isGlobal ? GLOBAL_COM : message.channel.server.id;
		if(isGlobal) {
			if(isOwner) {
				return id;
			}
		} else {
			if(isOwner || readonly) {
				return id;
			}
		}
	}

	// custom commands are only usable in their respective servers
	// ONLY characters in {...} blocks are given special treatment.
	function CustomCommand(command, response) {
		this.command = command.toLowerCase();
		this.response = response;
		this.builders = [];
		var commandRegex = new RegExp(COMMAND_REGEX), match, innerMatch;
		while(match = commandRegex.exec(response)) {
			logger.silly(match);
			if(typeof match[1] === 'string') {
				if(match[1]) {
					this.builders.push(_rawStringBuilder(match[1]));
				}
				if(ARG_REGEX.test(match[3])) {
					this.builders.push(_argBuilder(match[1]));
				} else if(USER_REGEX.test(match[3])) {
					this.builders.push(_userBuilder());
				} else if(innerMatch = API_REGEX.exec(match[3])) {
					this.builders.push(_apiBuilder(innerMatch));
				} else {
					this.builders.push(_rawStringBuilder(match[2]));
				}
			} else {
				this.builders.push(_rawStringBuilder(match[4]));
			}
		}
	}

	CustomCommand.prototype.build = function(message, args) {
		return Promise.all(_.map(this.builders, function(builder) {
			return builder(message, args);
		})).then(function(results) {
			return results.join('');
		});
	};

	CustomCommand.prototype.process = function(message) {
		var args = message.content.split(' ');
		if(args[0].toLowerCase() === this.command) {
			// exec
			this.build(message, args).then(function(response) {
				client.sendMessage(message.channel, response);
			});
			return true;
		}
		return false;
	};

	// just send raw string data
	function _rawStringBuilder(str) {
		return function() {
			return str;
		};
	}

	// {1}, {2}, ...
	function _argBuilder(n) {
		n = +n;
		return function(message, args) {
			return args[n] || '';
		};
	}

	// {user}
	function _userBuilder() {
		return function(message) {
			return message.sender.toString();
		};
	}

	// {api [url]}
	function _apiBuilder(api) {
		return function() {
			return request.getAsync(api[1]).then(function(res) {
				if(res.statusCode !== 200) {
					return 'Response status code not 200 (got ' + res.statusCode + ')';
				}
				if(res.headers['content-type'] !== 'text/plain') {
					return 'Response must be in `text/plain`';
				}
				if(res.body.length > 2000) {
					return 'Response length too large (max 2000)';
				}
				return res.body;
			}, function(err) {
				logger.warn(err);
				return 'Invalid url ' + api[1];
			});
		};
	}

};