const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'));

const COMMAND_REGEX = /([^{]*)({([^}]*)})|(.+)/g;
const ARG_REGEX = /^[1-9][0-9]?$/;
const USER_REGEX = /^user$/i;
const API_REGEX = /^api (https?:\/\/[^ ]+)$/i;
const MATH_REGEX = /^math ([0-9a-zA-Z\+-\\*\/\(\)]+)$/i;
// TODO {select 1+4/5 from [1, 2, 3, 4, 5]} syntax
const mathFn = {'random': ()=>Math.random(),  'args':(arg, args)=>+args[arg]};

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
	var expression = new Expression(math[1]);
	return function(message, args) {
		return expression.execute(args);
	};
}

class Expression {
	constructor(chars) {
		this.chars = chars.split('');
	}

	// builder methods

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

	// value: a, where a is a number, function(args, random), or (expression)
	value() {
		var number = '', fn = '', expression;
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
		while(/[a-z]/.test(this.peek())) {
			fn += this.consume();
		}
		if(fn) {
			if('(' !== this.peek()) {
				throw new Error('Unexpected character ' + this.peek() + ' expected (');
			}
			this.consume();
			if(')' !== this.peek()) {
				expression = this.expression();
			}
			if(')' !== this.peek()) {
				throw new Error('Unexpected character ' + this.peek() + ' expected )');
			}
			this.consume();
			return [fn, expression];
		}
		if('(' === this.peek()) {
			this.consume();
			expression = this.expression();
			if(')' !== this.peek()) {
				throw new Error('Unexpected character ' + this.peek() + ' expected )');
			}
			this.consume();
			return expression;
		}
		throw new Error('Unexpected character ' + this.peek());
	}

	// executor methods

	execute(args) {
		if(!this._builtExpression) {
			this._builtExpression = this.expression();
			if(!this.done()) {
				throw new Error('Unexpected character ' + this.peek());
			}
		}
		return this.executeValue(this._builtExpression, args);
	}

	executeValue(value, args) {
		if(typeof value === 'number') {
			return value;
		}
		if(Array.isArray(value)) {
			return this.executeArray(value, args);
		}
	}

	executeArray(arr, args) {
		var value, value2;
		if(typeof arr[0] === 'string') {
			var fn = arr[0];
			var arg = arr[1] ? this.executeArray(arr[1]) : null;
			return mathFn[fn](arg, args);
		}
		value = this.executeValue(arr[0], args);
		for(var i = 1; i < arr.length; i += 2) {
			value2 = this.executeValue(arr[i + 1], args);
			if(arr[i] === '+') {
				value += value2;
			}
			if(arr[i] === '-') {
				value -= value2;
			}
			if(arr[i] === '*') {
				value *= value2;
			}
			if(arr[i] === '/') {
				value /= value2;
			}
		}
		return value;
	}
}

module.exports = CustomCommand;
