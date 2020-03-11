const _ = require('underscore');
const { Client } = require('discord.js');
const logger = require('./logger');
const db = require('./db');
const Messaging = require('./lib/Messaging');

function startup(plugins) {
  var client = new Client({
    disabledEvents: ['TYPING_START']
  });
  var messaging;

  client.on('message', function(message) {
    if (message.author.id === client.user.id || message.author.bot) {
      return;
    }
    messaging.process(message);
  });

  client.on('disconnected', function() {
    throw new Error('disconnected');
  });

  client.on('error', function(error) {
    throw error;
  });

  client.on('ready', function() {
    logger.info('Harmony activated');
    client.user.setActivity('!commands [active]');
  });

  db.get().then(function(data) {
    var settings = data.settings;
    messaging = new Messaging(client, _.extend({}, settings));
    logger.transports.console.level = settings.logLevel;
    plugins
      .map(plugin => require(plugin))
      .forEach(function(plugin) {
        messaging.addPlugin(plugin);
      });
    client.login(settings.discord.token);
  });

  function shutdown() {
    logger.info('Shutting down');
    messaging.stop();
    db.release();
    client.destroy();
    setTimeout(function() {
      process.exit(0);
    }, 1000);
  }

  process.on('unhandledRejection', (reason, p) => {
    logger.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
  });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return messaging;
}

module.exports = startup;
