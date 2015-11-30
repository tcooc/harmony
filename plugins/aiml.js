var _ = require('underscore');
var Promise = require('bluebird');
var aiml = Promise.promisifyAll(require('aiml'));
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var winston = require('winston');

var AIML_DIR = 'aiml';
var AIML_LOAD_ORDER;

function getAIMLLoadOrder() {
	var loadOrder = fs.readFileSync(path.join(AIML_DIR, 'loadorder.txt').toString());
	return _(loadOrder.split('\n')).map(function(requirement) {
		return requirement.trim();
	})
	.filter(function(requirement) {
		return requirement.length > 0;
	});
}

try {
	AIML_LOAD_ORDER = getAIMLLoadOrder();
	winston.info('AIML load order ' + AIML_LOAD_ORDER);
} catch(e) {
	AIML_LOAD_ORDER = null;
}


function aimlPlugin(messaging, client) {
	var topics = fs.readdirAsync(AIML_DIR).then(function(files) {
		files = _.filter(files, function(file) {
			return /^(.*).aiml$/.test(file);
		});
		_.each(AIML_LOAD_ORDER, function(requirement) {
			var index = files.indexOf(requirement);
			if(index === -1) {
				throw new Error('AIML missing required file ' + requirement);
			}
			files.splice(index, 1);
			files.unshift(requirement);
		});
		var filePaths = _.map(files, function(file) {
			return path.join(AIML_DIR, file);
		});
		return aiml.parseFilesAsync(filePaths);
	});

	var ready = new Promise(function(resolve) {
		client.on('ready', resolve);
	});
	Promise.all([topics, ready])
	.then(function(results) {
		var engine = new aiml.AiEngine('discord', results[0], {name: client.user.username});
		messaging.addCommandHandler(/^aiml/i, function(message, content) {
			engine.replyAsync({name: message.author.username}, content.slice(1).join(' ')).then(function(response) {
				client.sendMessage(message.channel, response);
			});
			return true;
		});
		winston.info('AIML engine loaded');
	});
}

module.exports = AIML_LOAD_ORDER ? aimlPlugin : function(){};
