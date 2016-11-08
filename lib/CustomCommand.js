const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'));

const COMMAND_REGEX = /([^{]*)({([^}]*)})|(.+)/g;
const ARG_REGEX = /^[1-9][0-9]?$/;
const USER_REGEX = /^user$/i;
const API_REGEX = /^api (https?:\/\/[^ ]+)$/i;

// custom commands are only usable in their respective servers
// ONLY characters in {...} blocks are given special treatment.
class CustomCommand {
	constructor(command, response) {
		this.command = command.toLowerCase();
		this.response = response;
		this.builders = [];
		var commandRegex = new RegExp(COMMAND_REGEX), match, innerMatch;
		while(!!(match = commandRegex.exec(response))) {
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

	build(message, args) {
		return Promise.all(this.builders.map((builder) => builder(message, args))).then(function(results) {
			return results.join('');
		});
	}

	process(message) {
		var args = message.content.split(' ');
		if(args[0].toLowerCase() === this.command) {
			// exec
			this.build(message, args).then(function(response) {
				message.channel.sendMessage(response);
			});
			return true;
		}
		return false;
	}

	toString() {
		return this.command + ' ' + this.response;
	}
}

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
		return message.author.toString();
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
		}, function() {
			return 'Invalid url ' + api[1];
		});
	};
}

module.exports = CustomCommand;
