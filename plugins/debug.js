var child_process = require('child_process');
var Discord = require('discord.js');
var db = require('../db');
var util = require('util');
var vm = require('vm');
var logger = require('../logger');

messaging.addCommandHandler(/^!eval/i, function (message, content) {
  if (!messaging.isBotAdmin(message.author) || content.length <= 1) {
    return;
  }
  logger.debug('eval', content);
  try {
    var result = eval('(' + content.slice(1).join(' ') + ')'); // jshint ignore:line
    logger.info(util.inspect(result, { depth: 1, colors: true }));
    messaging.send(message, result.toString());
  } catch (e) {
    logger.info(e.stack);
    messaging.send(message, '```' + e.stack + '```');
  }
  return true;
});

messaging.addCommandHandler(/^!run/i, function (message, content) {
  if (content.length <= 1) {
    return;
  }
  setTimeout(function () {
    var result;
    try {
      result = vm.runInNewContext(
        content.slice(1).join(' '),
        {},
        { timeout: 1000, filename: 'run' }
      );
    } catch (e) {
      result = e.toString();
      if (!(e instanceof SyntaxError) && e.stack) {
        var stack = e.stack.split('\n');
        // if run in a new context, the stack only goes 4 levels deep
        result = result + '\n' + stack.slice(0, stack.length - 4).join('\n');
      }
      result = '```' + result + '```';
    }
    messaging.send(message, result);
  }, 0);
  return true;
});

messaging.addCommandHandler(/^!message:channel/i, function (message, content) {
  if (!messaging.isBotAdmin(message.author) || content.length < 3) {
    return;
  }
  var to = client.channels.get(content[1]);
  var text = content.slice(2).join(' ');
  if (to) {
    logger.info('Sending ' + text + ' to ' + to.id);
    messaging.send(to, text);
  }
  return true;
});

messaging.addCommandHandler(/^!message:user/i, function (message, content) {
  if (!messaging.isBotAdmin(message.author) || content.length < 3) {
    return;
  }
  var to = client.users.get(content[1]);
  var text = content.slice(2).join(' ');
  if (to) {
    logger.info('Sending ' + text + ' to ' + to.id);
    messaging.send(to, text);
  }
  return true;
});

messaging.addCommandHandler(/^!reload/i, function (message) {
  if (!messaging.isBotAdmin(message.author)) {
    return;
  }
  logger.info('Triggering reload');
  child_process.exec('git pull', function () {
    process.kill(process.pid, 'SIGINT');
  });
  return true;
});

const validLevels = ['info', 'debug', 'silly'];
messaging.addCommandHandler(/^!loglevel/i, function (message, content) {
  if (!messaging.isBotAdmin(message.author)) {
    return;
  }
  var level = content[1];
  if (content[1] && validLevels.includes(content[1])) {
    db.update(function (data) {
      data.settings.logLevel = level;
    });
    logger.transports.console.level = level;
    messaging.send(message, 'Log level set to `' + level + '`');
  } else {
    messaging.send(
      message,
      'Invalid log level. Possible values: ' + validLevels
    );
  }
  return true;
});

messaging.addCommandHandler(/^!clear/i, function (message, content) {
  if (!messaging.hasAuthority(message)) {
    return;
  }
  var type = content[1];
  var promise = message.channel.fetchMessages({ limit: 100 });
  if (type !== 'all') {
    promise = promise.then(function (messages) {
      return messages.filter(function (message) {
        return message.author.id === client.user.id;
      });
    });
  }
  promise = promise.then(function (messages) {
    messages.forEach(function (message) {
      promise = promise.then(function () {
        return message.delete();
      });
    });
  });
  return true;
});

module.exports = {
  commands
};
