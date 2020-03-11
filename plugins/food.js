const _ = require('underscore');
const htmlparser = require('htmlparser2');
const logger = require('../logger');
const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'));
const URL = require('url');
const { bot } = require('../lib');
var Discord = require('discord.js');

function loadAllFoods(foodUrl) {
  return request.getAsync(foodUrl).then(function(response) {
    var foodsString;
    var readText = false;
    var parser = new htmlparser.Parser({
      onopentag: function(name, attribs) {
        readText = name === 'script' && attribs.type === 'text/javascript';
      },
      ontext: function(text) {
        if (readText) {
          foodsString =
            _.find(text.split('\n'), function(line) {
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
  var randomFood =
    foodUrl +
    '/pictures/' +
    randomFoods[Math.round(Math.random() * randomFoods.length)] +
    '/';
  return request.getAsync(randomFood).then(function(response) {
    var url = null;
    var parser = new htmlparser.Parser({
      onopentag: function(name, attribs) {
        if (attribs.id === 'mainPhoto') {
          url = attribs.src;
        }
      }
    });
    parser.write(response.body);
    parser.end();
    return url;
  });
}

module.exports = function(messaging) {
  var randomFoods = loadAllFoods(messaging.settings.foodUrl).then(function(
    foodsString
  ) {
    logger.debug('Food is ready');
    return JSON.parse(/^\s*var randomSlugs = (.*);\s*$/.exec(foodsString)[1]);
  });
  messaging.addCommandHandler(/^!food/i, function(message) {
    randomFoods
      .then(function(randomFoods) {
        return getRandomFood(messaging.settings.foodUrl, randomFoods);
      })
      .then(function(url) {
        var fileName = URL.parse(url)
          .path.split('/')
          .pop();
        logger.debug('Random food', url, fileName);
        return bot.getFile(url).then(function(data) {
          message.channel.send('', new Discord.Attachment(data, fileName));
        });
      });
    return true;
  });
};
