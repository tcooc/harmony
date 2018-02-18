const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'));

const COMMAND_REGEX = /([^{]*)({([^}]*)})|(.+)/g;
const ARG_REGEX = /^[1-9][0-9]?$/;
const USER_REGEX = /^user$/i;
const API_REGEX = /^api (https?:\/\/[^ ]+)$/i;
const MATH_REGEX = /^math ([0-9a-zA-Z\+-\\*\/\(\)]+)$/i;
// TODO {select 1+4/5 from [1, 2, 3, 4, 5]} syntax

// custom commands are only usable in their respective servers
// ONLY characters in {...} blocks are given special treatment.
class CustomCommand {
	constructor(command, response) {
		var commandRegex = new RegExp(COMMAND_REGEX), match, textMatch, commandMatch, noneMatch, innerMatch;
		this.command = command.toLowerCase();
		this.response = response;
		this.builders = [];
		while(!!(match = commandRegex.exec(response))) {
			textMatch = match[1];
			commandMatch = match[3];
			noneMatch = match[4];
			if(typeof textMatch === 'string') {
				if(textMatch) {
					this.builders.push(_rawStringBuilder(textMatch));
				}
				if(ARG_REGEX.test(commandMatch)) {
					this.builders.push(_argBuilder(commandMatch));
				} else if(USER_REGEX.test(commandMatch)) {
					this.builders.push(_userBuilder());
				} else if(!!(innerMatch = API_REGEX.exec(commandMatch))) {
					this.builders.push(_apiBuilder(innerMatch));
				} else if(!!(innerMatch = MATH_REGEX.exec(commandMatch))) {
					this.builders.push(_mathBuilder(innerMatch));
				} else {
					this.builders.push(_rawStringBuilder(commandMatch));
				}
			} else {
				this.builders.push(_rawStringBuilder(noneMatch));
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
				message.channel.send(response);
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

// {math [expression]}
function _mathBuilder(math) {
	var builder = new ExpressionBuilder(math[1]);
	var built = builder.build();
	if(builder.error) {
		console.log(builder.error);
		built = 'error';
	} else {
		built = JSON.stringify(built);
	}
	return function() {
		return built;
	};
}

class ExpressionBuilder {
	constructor(chars) {
		this.chars = chars.split('');
	}

	build() {
		try {
			var expression = this.expression();
			if(!this.done()) {
				throw new Error('Unexpected character ' + this.peek());
			}
			return expression;
		} catch(e) {
			this.error = e;
		}
		return null;
	}

	done() {
		return !this.chars.length;
	}

	peek() {
		return this.chars[0];
	}

	consume() {
		return this.chars.shift();
	}

	// expression: a+b or a-b, where a and b are factors
	expression() {
		var factor, factors = [];
		do {
			factor = this.factor();
			if(factor) {
				factors.push(factor);
				if(this.peek() === '+' || this.peek() === '-') {
					factors.push(this.consume());
				}
			}
		} while(factor && factors.length % 2 === 0);
		if(factors.length % 2 === 0) {
			throw new Error('Unexpected end of input');
		}
		return factors;
	}

	// factor: a*b or a/b, where a and b are values
	factor() {
		var value, values = [];
		do {
			value = this.value();
			if(value) {
				values.push(value);
				if(this.peek() === '*' || this.peek() === '/') {
					values.push(this.consume());
				}
			}
		} while(value && values.length % 2 === 0);
		if(values.length % 2 === 0) {
			throw new Error('Unexpected end of input');
		}
		return values;
	}

	// value: a, where a is a number, variable, function, or (expression)
	value() {
		var number = '';
		if(this.done()) {
			return;
		}
		while(/[0-9]/.test(this.peek())) {
			number += this.consume();
		}
		if(number) {
			number = +number;
			return number;
		}
		if('(' === this.peek()) {
			this.consume();
			var expression = this.expression();
			if(')' !== this.peek()) {
				throw new Error('Unexpected character ' + this.peek() + ' expected )');
			}
			this.consume();
			return expression;
		}
		throw new Error('Unexpected character ' + this.peek());
	}
}

module.exports = CustomCommand;
