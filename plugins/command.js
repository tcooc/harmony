global.Promise = require('bluebird');
var _ = require('underscore');

var COMMAND_REGEX = /([^{]*)({([^}]*)})|(.+)/g;
var ARG_REGEX = /^[1-9][0-9]?$/;
var USER_REGEX = /^user$/i;
var API_REGEX = /^api (https?:\/\/[^ ]+)$/i;

module.exports = function(messaging, client) {

messaging.addCommandHandler(/^!custom/i, function(message) {
	// show custom commands
	return true;
});

messaging.addCommandHandler(/^!custom:set/i, function(message) {
	return true;
});

messaging.addCommandHandler(/^!custom:remove/i, function(message) {
	return true;
});

messaging.isOwner(message.author, message.channel.server);

var customCommands = {};
customCommands[server.id] = customCommands[server.id] || [];
customCommands[server.id].push(new CustomCommand(..., ...));

// custom commands are only usable in their respective servers
// ONLY characters in {...} blocks are given special treatment.
function CustomCommand(command, response) {
	this.command = command.toLowerCase();
	this.response = response;
	this.builders = [];
	var commandRegex = new RegExp(COMMAND_REGEX), match, innerMatch;
	while(match = commandRegex.exec(response)) {
		console.log(match);
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
		return api[1]; // TODO request().then...
	};
}

};