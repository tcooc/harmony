var _ = require('underscore');
var htmlparser = require('htmlparser2');
var logger = require('logger');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var URL = require('url');

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
	});
}

function getRandomFood(foodUrl, randomFoods) {
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
	var randomFoods;
	loadAllFoods(messaging.settings.foodUrl).then(function(foodsString) {
		randomFoods = JSON.parse(/^\s*var randomSlugs = (.*);\s*$/.exec(foodsString)[1]);
		logger.debug('Food is ready');
	});
	messaging.addCommandHandler(/^!food/i, function(message) {
		if(randomFoods) {
			var fileName;
			getRandomFood(messaging.settings.foodUrl, randomFoods)
			.then(function(url) {
				fileName = URL.parse(url).path.split('/').pop();
				logger.debug('Random food', url, fileName);
				return getFoodImage(url);
			})
			.then(function(data) {
				client.sendFile(message.channel, new Buffer(data, 'binary'), fileName);
			});
		}
		return true;
	});
};
