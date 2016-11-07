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

module.exports = function(messaging) {

	var commandCache = {};

	function refreshCache(id, data, force) {
		if(force || !commandCache[id]) {
			logger.debug('refreshing command cache for ' + id);
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
				messaging.send(message, 'Please specify a command and response');
			} else {
				// set server command
				db.update(function(data) {
					var commands = data.customCommands[id] = data.customCommands[id] || {};
					commands[name] = response;
					refreshCache(id, data, true);
				});
				messaging.send(message, name + ' created');
			}
		} else {
			messaging.send(message, 'Only the owner may edit custom commands');
		}
		return true;
	});

	messaging.addCommandHandler(/^!custom:remove/i, function(message, args) {
		var id = getCommandsId(message);
		if(id) {
			var name = args[1];
			if(!name) {
				messaging.send(message, 'Please specify a command to delete');
			} else {
				// remove server command
				db.update(function(data) {
					var commands = data.customCommands[id];
					if(commands) {
						delete commands[name];
						refreshCache(id, data, true);
					}
				});
				messaging.send(message, name + ' deleted');
			}
		} else {
			messaging.send(message, 'Only the owner may edit custom commands');
		}
		return true;
	});

	messaging.addCommandHandler(/^!custom:list/i, function(message) {
		var id = getCommandsId(message, true);
		if(id) {
			var commands = commandCache[id] || {};
			messaging.send(message, 'Custom commands:\n`' + Object.keys(commands).join('`, `') + '`');
		} else {
			messaging.send(message, 'Use this command in a server to print server commands');
		}
		return true;
	});

	messaging.addCommandHandler(/.*/, function(message, args) {
		var promise, id, ids;
		if(args.length) {
			ids = [GLOBAL_COM];
			id = getCommandsId(message, true);
			if(id) {
				ids.unshift(id);
			}
			if(_.find(ids, (id) => !commandCache[id])) { // if there exists uncached commands
				promise = db.get().then((data) => _.each(ids, (id) => refreshCache(id, data)));
			} else {
				promise = Promise.resolve();
			}
			return promise.then(function() {
				return _(ids).chain()
					.map((id) => commandCache[id])
					.reduce((memo, value) => memo.concat(_.toArray(value)), [])
					.find((command) => command.process(message)).value();
			});
		}
		return false;
	});

	function getCommandsId(message, readonly) {
		var isGlobal = message.channel instanceof Discord.DMChannel;
		var isOwner = message.author.id === messaging.settings.owner || messaging.isOwner(message.author, message.guild);
		var id = isGlobal ? GLOBAL_COM : message.guild.id;
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
		while(!!(match = commandRegex.exec(response))) {
			logger.silly(match);
			if(typeof match[1] === 'string') {
				if(match[1]) {
					this.builders.push(_rawStringBuilder(match[1]));
				}
				if(ARG_REGEX.test(match[3])) {
					this.builders.push(_argBuilder(match[3]));
				} else if(USER_REGEX.test(match[3])) {
					this.builders.push(_userBuilder());
				} else if(!!(innerMatch = API_REGEX.exec(match[3]))) {
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
				messaging.send(message, response);
			});
			return true;
		}
		return false;
	};

	CustomCommand.prototype.toString = function() {
		return this.command + ' ' + this.response;
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