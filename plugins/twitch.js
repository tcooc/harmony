var _ = require('underscore');
var { EventEmitter } = require('events');
const { hasAuthority } = require('../lib/Messaging');
const { updateLoadout } = require('../lib/warframe-loadout');
var { logger } = require('../logger');
var { db } = require('../db');
const { SlashCommandBuilder } = require('discord.js');

let client;
let client_id;
let secret;
let token;
// map of stream->broadcast specs
let channelWatchers = {};
// warframe-loadout stream->igns
let loadoutWatchers = {};
// channel status values: false, true, timestamp
// if false, means that status hasn't been initiated
// if true, means that status has been initiated, and stream was offline
// if timestamp, means that status has been initiated, and stream was online
const channelsStatus = {};

let timeout;
let tokenTimeout;
let updateLoadoutPromise = Promise.resolve();

const eventBus = new EventEmitter();

eventBus.on('update', (name, stream) => {
  logger.silly('update', name, stream);
  const streaming = stream && stream.type === 'live';
  // TODO don't update while offline
  if (loadoutWatchers[name]) {
    // chain promises so we don't overload the browser
    updateLoadoutPromise = updateLoadoutPromise.finally(() =>
      updateLoadout(loadoutWatchers[name])
    );
  }
  if (streaming) {
    if (channelsStatus[name] && channelsStatus[name] !== stream.started_at) {
      eventBus.emit('statusChanged', name, stream, streaming);
    }
    channelsStatus[name] = stream.started_at;
  } else {
    channelsStatus[name] = channelsStatus[name] || true;
  }
});

eventBus.on('statusChanged', (name, stream, streaming) => {
  if (streaming) {
    logger.info('Stream started: ' + stream.user_name + ' ' + stream.game);
    const watchers = channelWatchers[name];
    _.each(watchers, async (watcher) => {
      const channel = await client.channels.fetch(watcher);
      const url = `https://www.twitch.tv/${stream.user_login}`;
      const thumbnail = stream.thumbnail_url
        .replace('{width}', 128 * 10)
        .replace('{height}', 72 * 10);
      const cacheBuster = `v=${encodeURIComponent(stream.started_at)}`;
      channel.send({
        content: `${stream.user_name} is now streaming ${stream.game_name} at ${url}`,
        embeds: [
          {
            title: stream.title,
            url,
            image: { url: `${thumbnail}?${cacheBuster}` }
          }
        ]
      });
    });
  }
});

// each spec has stream and broadcast
function loadWatchers(specs) {
  channelWatchers = {};
  loadoutWatchers = {};
  _.each(specs, function (spec) {
    if (!channelWatchers[spec.stream]) {
      channelWatchers[spec.stream] = [];
    }
    channelWatchers[spec.stream].push(spec.broadcast);
    channelsStatus[spec.stream] = channelsStatus[spec.stream] || false;

    if (spec.ign) {
      loadoutWatchers[spec.stream] = spec.ign;
    }
  });
}

const getStreams = async () => {
  if (!Object.keys(channelWatchers).length) {
    return;
  }
  if (!token) {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: `client_id=${client_id}&client_secret=${secret}&grant_type=client_credentials`
    });
    if (response.status >= 400) {
      throw new Error(
        `get token responded with status ${
          response.status
        } body ${await response.text()}`
      );
    }
    token = await response.json();
    logger.silly('token', token);
    tokenTimeout = setTimeout(() => {
      token = null;
    }, token.expires_in);
  }

  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(
        Object.keys(channelWatchers).join(',')
      )}`,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          'Client-ID': client_id
        }
      }
    );
    if (response.status >= 400) {
      throw new Error(
        `get streams responded with status ${
          response.status
        } body ${await response.text()}`
      );
    }
    if (!response.headers.get('content-type').startsWith('application/json')) {
      logger.warn(
        `getStreams returned invalid content type ${response.headers.get(
          'content-type'
        )}`
      );
      return [];
    } else {
      const body = await response.json();
      logger.silly('getStreams', body);
      return body.data;
    }
  } catch (e) {
    logger.error('getStreams error', e);
  }
};

const command = {
  data: new SlashCommandBuilder()
    .setName('twitch')
    .setDescription('Create or clear twitch notifications in this channel')
    .addStringOption((option) =>
      option.setName('channel').setDescription('Twitch channel id')
    )
    .addStringOption((option) =>
      option
        .setName('in-game-name')
        .setDescription(
          'Warframe player name to sync builds (experimental, PC only)'
        )
    ),
  execute: async (interaction) => {
    if (!hasAuthority(interaction)) {
      interaction.reply('Must be server admin');
      return;
    }
    const channel = interaction.options.getString('channel');
    const ign = interaction.options.getString('in-game-name');
    db.update((data) => {
      let index = data.twitch.findIndex(
        (spec) => spec.broadcast === interaction.channelId
      );
      if (index === -1) {
        index = data.twitch.length;
      }
      if (channel) {
        data.twitch[index] = {
          stream: channel.toLowerCase(),
          broadcast: interaction.channelId,
          ign
        };
        interaction.reply(`Current channel following Twitch \`${channel}\``);
      } else {
        data.twitch.splice(index, 1);
        interaction.reply(`Current channel unfollowing Twitch \`${channel}\``);
      }
      loadWatchers(data.twitch);
    });
  }
};

const update = async () => {
  const streams = await getStreams();
  const streamsMap = {};
  _.each(streams, (stream) => {
    streamsMap[stream.user_name.toLowerCase()] = stream;
  });
  _.each(channelWatchers, (_, name) => {
    if (!streamsMap[name]) {
      streamsMap[name] = null;
    }
  });
  _.each(streamsMap, (stream, name) => {
    eventBus.emit('update', name, stream);
  });
  logger.silly('streamsMap', streamsMap);
  logger.silly('channelsStatus', channelsStatus);
};

const updateLoop = async () => {
  try {
    await update();
  } finally {
    timeout = setTimeout(updateLoop, 30 * 1000);
  }
};

const startup = async (c) => {
  client = c;
  const { settings, twitch } = await db.get();
  client_id = settings.twitch.client_id;
  secret = settings.twitch.client_secret;
  loadWatchers(twitch);
  updateLoop();
  logger.info(`Twitch plugin started with spec.length=${twitch.length}`);
};

const cleanup = () => {
  clearTimeout(timeout);
  clearTimeout(tokenTimeout);
};

module.exports = {
  commands: [command],
  startup,
  cleanup
};
