const _ = require('underscore');
const Discord = require('discord.js');
const AudioManager = require('../lib/audio/AudioManager');
const logger = require('../logger');

module.exports = function(messaging, client) {
  var audioManagers = {};

  function createAudioManager() {
    var audioManager = new AudioManager(messaging.settings);
    audioManager.eventBus.on('error', function(e) {
      logger.error(e.stack);
    });
    audioManager.shuffle = true;

    audioManager.eventBus.on('playing', function(playable) {
      if (!playable.output || true) {
        return;
      }
      if (playable.info) {
        messaging.send(
          playable.output,
          'Playing **' + playable + '** (' + playable.info.title + ')'
        );
      } else {
        messaging.send(playable.output, 'Playing **' + playable + '**');
      }
    });

    audioManager.eventBus.on('stopping', function(playable) {
      if (!playable.output || true) {
        return;
      }
      if (playable.info) {
        messaging.send(
          playable.output,
          'Finished playing **' + playable + '** (' + playable.info.title + ')'
        );
      } else {
        messaging.send(
          playable.output,
          'Finished playing **' + playable + '**'
        );
      }
    });
    return audioManager;
  }

  var getOrCreateAudioManager = function(guild) {
    if (!guild) {
      return null;
    }
    if (!audioManagers[guild.id]) {
      audioManagers[guild.id] = createAudioManager();
    }
    return audioManagers[guild.id];
  };

  messaging.addCommandHandler(/^!audio:play/i, function(message, content) {
    var userVoiceChannel = client.channels.find(channel => {
      return (
        channel instanceof Discord.VoiceChannel &&
        channel.members.find(member => member.id === message.author.id)
      );
    });
    if (!userVoiceChannel) {
      messaging.send(message, 'Connect to a voice channel');
      return true;
    }
    var audioManager = getOrCreateAudioManager(userVoiceChannel.guild);
    audioManager
      .join(userVoiceChannel)
      .then(function() {
        var urlString = content[1];
        if (urlString.startsWith('www')) {
          urlString = 'http://' + urlString;
        }
        return audioManager.play(urlString, message.channel);
      })
      .then(
        function(playables) {
          if (playables.length > 1) {
            messaging.send(message, 'Playlist added');
          } else if (audioManager.queue.length > 0) {
            messaging.send(message, 'Added to queue');
          }
        },
        function(e) {
          logger.warn(e);
          messaging.send(message, 'Your link is broken');
        }
      );
    return true;
  });

  messaging.addCommandHandler(/^!audio:loop/i, function(message, content) {
    var audioManager = getOrCreateAudioManager(message.guild);
    if (!audioManager) {
      messaging.send(message, 'Audio player not found');
      return true;
    }
    var loop = content[1] ? content[1] === 'yes' : audioManager.loop;
    var shuffle = content[2] ? content[2] === 'yes' : audioManager.shuffle;
    audioManager.setLooping(loop, shuffle);
    messaging.send(
      message,
      'Looping ' +
        (audioManager.loop ? 'enabled' : 'disabled') +
        ', shuffle ' +
        (audioManager.shuffle ? 'enabled' : 'disabled')
    );
    return true;
  });

  messaging.addCommandHandler(/^!audio:next/i, function(message) {
    var audioManager = getOrCreateAudioManager(message.guild);
    if (!audioManager) {
      messaging.send(message, 'Audio player not found');
      return true;
    }
    if (!audioManager.voiceConnection) {
      messaging.send(message, 'Not playing anything');
    } else {
      audioManager.stop();
    }
    return true;
  });

  messaging.addCommandHandler(/^!audio:remove/i, function(message, content) {
    var audioManager = getOrCreateAudioManager(message.guild);
    if (!audioManager) {
      messaging.send(message, 'Audio player not found');
      return true;
    }
    logger.debug(
      'playing',
      audioManager.currentlyPlaying
        ? audioManager.currentlyPlaying.toString()
        : 'nothing'
    );
    logger.debug('queue', _.pluck(audioManager.queue, 'url'));
    logger.debug('played', _.pluck(audioManager.played, 'url'));
    var url = content[1];
    if (url) {
      audioManager.remove(url);
    }
    return true;
  });

  messaging.addCommandHandler(/^!audio:clear/i, function(message) {
    var audioManager = getOrCreateAudioManager(message.guild);
    if (!audioManager) {
      messaging.send(message, 'Audio player not found');
      return true;
    }
    audioManager.clear();
    messaging.send(message, 'Cleared player');
    return true;
  });

  messaging.addCommandHandler(/^!audio:leave/i, function(message) {
    var audioManager = getOrCreateAudioManager(message.guild);
    if (!audioManager) {
      messaging.send(message, 'Audio player not found');
      return true;
    }
    audioManager.clear();
    if (audioManager.voiceConnection) {
      audioManager.voiceConnection.disconnect();
      audioManager.voiceConnection = null;
    }
    messaging.send(message, 'Leaving voice channel');
    return true;
  });

  client.on('ready', function() {
    if (!client.user.bot) {
      // user it not bot, must use single manager
      var audioManager = createAudioManager();
      getOrCreateAudioManager = () => audioManager;
    }
  });
};
