var _ = require('underscore');
var htmlparser = require('htmlparser2');
var logger = require('logger');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));

module.exports = function(foodUrl) {
	var randomFoods = null;
	request.getAsync(foodUrl)
	.then(function(response) {
		var foodsString;
		var readText = false;
		var parser = new htmlparser.Parser({
			onopentag: function(name, attribs) {
				readText = name === 'script' && attribs.type === 'text/javascript';
			},
			ontext: function(text) {
				if(readText) {
					foodsString = _.find(text.split('\n'), function(line) {
						return line.indexOf('randomSlugs') > -1;
					}) || foodsString;
				}
			}
		});
		parser.write(response.body);
		parser.end();
		return foodsString;
	})
	.then(function(foodsString) {
		randomFoods = eval('(' + /^\s*var randomSlugs = (.*);\s*$/.exec(foodsString)[1] + ')'); // jshint ignore:line
		logger.debug('Food is ready');
	});

	function getRandomFood() {
		var randomFood = foodUrl + '/pictures/' + randomFoods[Math.round(Math.random() * randomFoods.length)] + '/';
		return request.getAsync(randomFood)
		.then(function(response) {
			var url = null;
			var parser = new htmlparser.Parser({
				onopentag: function(name, attribs) {
					if(attribs.id === 'mainPhoto') {
						url = attribs.src;
					}
				},
			});
			parser.write(response.body);
			parser.end();
			return url;
		});
	}

	return function(messaging, client) {
		messaging.addCommandHandler(/^!food/i, function(message) {
			if(randomFoods) {
				getRandomFood().then(function(url) {
					client.sendMessage(message.channel, url);
				});
			}
			return true;
		});
	};
};
