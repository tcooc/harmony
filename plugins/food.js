var _ = require('underscore');
var htmlparser = require('htmlparser2');
var logger = require('logger');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var URL = require('url');

var randomFoods = null;
function loadAllFoods(foodUrl) {
	return request.getAsync(foodUrl)
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
}

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

function getFoodImage(url) {
	return request.getAsync({url: url, encoding: null}).then(function(response) {
		return response.body;
	});
}

module.exports = function(messaging, client) {
	loadAllFoods(messaging.settings.foodUrl);
	messaging.addCommandHandler(/^!food/i, function(message) {
		if(randomFoods) {
			var fileName;
			getRandomFood()
			.then(function(url) {
				fileName = URL.parse(url).path.split('/').pop();
				return getFoodImage(url);
			})
			.then(function(data) {
				client.sendFile(message.channel, new Buffer(data, 'binary'), fileName);
			});
		}
		return true;
	});
};
