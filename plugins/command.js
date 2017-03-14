const _ = require('underscore');
const Discord = require('discord.js');
const db = require('db');
const logger = require('logger');
const CustomCommand = require('lib/CustomCommand');

const GLOBAL_COM = '*';

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
		logger.silly('processing', message.content, args);
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

	// returns commands id if sender has permission to view/edit it
	function getCommandsId(message, readonly) {
		var isGlobal = message.channel instanceof Discord.DMChannel;
		var hasAuthority = messaging.hasAuthority(message);
		if(isGlobal) {
			if(message.author.id === messaging.settings.owner) {
				return GLOBAL_COM;
			}
		} else {
			if(hasAuthority || readonly) {
				return message.guild.id;
			}
		}
	}

};