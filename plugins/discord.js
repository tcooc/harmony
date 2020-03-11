module.exports = function(messaging, client) {
  messaging.addCommandHandler(/^!prefix/i, function(message, content) {
    if (!messaging.hasAuthority(message)) {
      return;
    }
    if (content.length === 1) {
      messaging.send(
        message,
        "Prefix for this server is '" + messaging.getPrefix(message) + "'"
      );
    } else {
      var prefix = content[1];
      if (prefix === '<none>') {
        prefix = '';
      }
      if (messaging.setPrefix(message, prefix)) {
        messaging.send(
          message,
          "Prefix for this server set to '" + prefix + "'"
        );
      }
    }
    return true;
  });

  messaging.addCommandHandler(/^!avatar/i, function(message, content) {
    if (!messaging.isBotAdmin(message.author)) {
      return;
    }
    client.user.setAvatar(content[1]);
    return true;
  });

  messaging.addCommandHandler(/^!username/i, function(message, content) {
    if (!messaging.isBotAdmin(message.author)) {
      return;
    }
    client.user.setUsername(content[1]);
    return true;
  });

  messaging.addCommandHandler(/^!invite/i, function(message) {
    if (client.user.bot) {
      client
        .generateInvite(['VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS'])
        .then(invite => {
          messaging.send(
            message.author,
            'Server owners/admins can invite me using ' + invite
          );
        });
    } else {
      messaging.send(
        message.author,
        'Invite Harmony using https://discordapp.com/oauth2/authorize' +
          '?client_id=244188157296246784&permissions=3072&scope=bot'
      );
    }
    return true;
  });
};
