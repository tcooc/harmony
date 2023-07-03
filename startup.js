const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { logger } = require('./logger');
const { db } = require('./db');

const startup = async (plugins) => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });
  const commands = new Collection();
  const cleanups = [];

  client.on(Events.InteractionCreate, async (interaction) => {
    logger.silly(
      interaction,
      interaction.isChatInputCommand(),
      interaction.commandName,
      interaction.channelId,
      interaction.member,
      interaction.user,
      interaction.memberPermissions
    );
    const command = commands.get(interaction.commandName);

    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command!',
          ephemeral: true
        });
      }
    }
  });

  client.on(Events.ClientReady, (client) => {
    logger.info(`${client.user.tag} activated`);
    logger.info(
      `Connected to ${client.guilds.cache.size} servers with a total of ${client.users.cache.size} users.`
    );
    client.user.setActivity('[active]');
  });

  const { settings } = await db.get();
  logger.level = settings.logLevel;
  for (let i = 0; i < plugins.length; i++) {
    const plugin = require(plugins[i]);
    if (plugin.startup) {
      await plugin.startup(client);
    }
    if (plugin.cleanup) {
      cleanups.push(plugin.cleanup);
    }
    if (plugin.commands) {
      plugin.commands.forEach((command) => {
        commands.set(command.data.name, command);
      });
    }
  }

  const shutdown = () => {
    logger.info('Shutting down');
    db.release();
    client.destroy();
    cleanups.forEach((cleanup) => cleanup());
  };

  process.on('unhandledRejection', (reason, p) => {
    logger.error(
      'Unhandled Rejection at: Promise',
      p,
      'reason:',
      reason,
      'stack:',
      reason.stack
    );
  });

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  client.login(settings.discord.token);
  return client;
};

module.exports = { startup };
