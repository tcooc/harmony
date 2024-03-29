const _ = require('underscore');
const Discord = require('discord.js');
const logger = require('../logger');
const { db } = require('../db');

const hasAuthority = async (interaction) => {
  const data = await db.get();
  if (interaction.user.id === data.settings.owner) {
    return true;
  }
  if (interaction.channel instanceof Discord.DMChannel) {
    return true;
  }
  return interaction.memberPermissions
    ? interaction.memberPermissions.any([
        'MANAGE_GUILD',
        'MANAGE_CHANNELS',
        'MANAGE_ROLES'
      ])
    : false;
};

// obsolete
class MessageSender {
  constructor(options) {
    _.extend(this, { interval: 1000, backlog: 100 }, options);
    this.queue = [];
    this.queueInterval = null;
  }

  popQueue() {
    if (this.queue.length === 0) {
      clearInterval(this.queueInterval);
      this.queueInterval = null;
    } else {
      var payload = this.queue.shift();
      var promise = payload.channel.send.apply(payload.channel, payload.args);
      promise
        .then(() => this._handleSent(payload))
        .catch((e) => this._handleError(e, payload))
        .then(payload.resolve, payload.reject);
    }
  }

  send(channel, ...args) {
    return new Promise((resolve, reject) => {
      if (channel.channel) {
        channel = channel.channel;
      }
      if (this.queue.length <= this.backlog) {
        this.queue.push({
          channel: channel,
          args: args,
          resolve: resolve,
          reject: reject
        });
      } else {
        logger.warn('too many messages queued, discarding');
      }
      if (!this.queueInterval) {
        this.queueInterval = setInterval(() => this.popQueue(), this.interval);
      }
    });
  }

  _handleSent(payload) {
    logger.debug('sent', payload);
  }

  _handleError(e, payload) {
    logger.error(payload.args, payload.channel);
    throw e;
  }
}

// obsolete
function passInCommand(messaging, regex, handler) {
  var wrapped = function (message) {
    var content = message.content;
    var prefix = messaging.getPrefix(message);
    if (prefix) {
      if (content.toUpperCase().startsWith(prefix.toUpperCase())) {
        content = content.substring(prefix.length).trim();
      } else {
        return false;
      }
    }
    if (regex.test(content)) {
      message.content = content;
      return handler(message, content.split(' '));
    }
    return false;
  };
  wrapped.regex = regex;
  return wrapped;
}

// obsolete
class Messaging {
  constructor(client, settings) {
    this.client = client;
    this.settings = settings;

    this.sender = new MessageSender();
    this.send = this.sender.send.bind(this.sender);

    this.hooks = [];
    this.postHooks = [];
    this.handlers = [];
    this.cleanups = [];
  }

  getPrefix(message) {
    var guild = message.guild,
      member;
    var prefix = this.settings.defaultPrefix || '';
    if (message.channel instanceof Discord.DMChannel) {
      return '';
    }
    if (guild && typeof db._data.prefix[guild.id] === 'string') {
      prefix = db._data.prefix[guild.id];
    }
    if (prefix === '@<me>') {
      prefix = this.client.user.toString();
      if (guild) {
        member = guild.members.get(this.client.user.id);
        if (member.nickname) {
          prefix = '<@!' + prefix.substring(2);
        }
      }
    }
    return prefix;
  }

  setPrefix(message, prefix) {
    if (message.guild) {
      db.update(function (data) {
        if (typeof prefix !== 'string') {
          delete data.prefix[message.guild.id];
        } else {
          data.prefix[message.guild.id] = prefix;
        }
      });
      return true;
    }
    return false;
  }

  isBotAdmin(user) {
    return user.id === this.settings.owner;
  }

  hasAuthority(message) {
    if (message.author.id === this.settings.owner) {
      return true;
    }
    if (message.channel instanceof Discord.DMChannel) {
      return true;
    }
    return message.member
      ? message.member.hasPermission('MANAGE_ROLES_OR_PERMISSIONS')
      : false;
  }

  addPlugin(plugin) {
    plugin(this, this.client);
  }

  addHandler(handler) {
    this.handlers.push(handler);
  }

  addCommandHandler(regex, handler) {
    this.handlers.push(passInCommand(this, regex, handler));
  }

  addHook(hook) {
    this.hooks.push(hook);
  }

  addPostHook(hook) {
    this.postHooks.push(hook);
  }

  addCleanup(cleanup) {
    this.cleanups.push(cleanup);
  }

  // processor logic deals with hooks, handlers, and postHooks
  // hooks are executed first
  // handlers are executed next until one returns true, or all handlers have been executed
  // postHooks are then executed, with the message and the "handled" parameter
  process(message) {
    if (message.guild) {
      logger.silly(
        'Prefix for server ' +
          message.guild.id +
          ' is ' +
          this.getPrefix(message)
      );
    }
    _.each(this.hooks, function (hook) {
      hook(message);
    });
    var handled = _.reduce(
      this.handlers,
      function (memo, handler) {
        return memo.then(function (handled) {
          if (handled) {
            return true;
          }
          return handler(message);
        });
      },
      Promise.resolve(false)
    );
    handled
      .then((handled) => {
        _.each(this.postHooks, function (hook) {
          hook(message, handled);
        });
      })
      .catch(function (e) {
        logger.error(e);
      });
  }

  broadcast(channels, content) {
    return Promise.all(
      _.map(
        channels,
        function (channel) {
          return this.send(channel, content);
        }.bind(this)
      )
    );
  }

  stop() {
    _.each(this.cleanups, function (cleanup) {
      cleanup();
    });
  }
}

module.exports = {
  hasAuthority
};
