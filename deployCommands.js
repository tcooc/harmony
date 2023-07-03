// adapted from https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands
const { REST, Routes } = require('discord.js');
const { db } = require('./db');
const { plugins } = require('./config');

const allServers = false;

const commands = [];

for (const p of plugins) {
  const plugin = require(p);
  if (plugin.commands) {
    plugin.commands.forEach((command) => {
      commands.push(command.data.toJSON());
    });
  }
}

// and deploy your commands!
(async () => {
  try {
    const { settings } = await db.get();
    // Construct and prepare an instance of the REST module
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const rest = new REST().setToken(settings.discord.token);
    const data = await rest.put(
      allServers
        ? Routes.applicationCommands(clientId)
        : Routes.applicationGuildCommands(
            settings.discord.client_id,
            settings.devServer
          ),
      { body: commands }
    );

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } finally {
    db.release();
  }
})();
