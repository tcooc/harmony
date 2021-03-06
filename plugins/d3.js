module.exports = function(messaging) {
  messaging.addCommandHandler(/^!d3gem/i, function(message, content) {
    if (content.length < 2) {
      messaging.send(message, 'Please specify a gem level');
    } else {
      var level = parseInt(content[1]);
      if (isFinite(level)) {
        messaging.send(
          message,
          'Gem Level = ' +
            level +
            '\n' +
            'Tier for guaranteed +3: ' +
            (level + 13) +
            '\n' +
            'Tier for guaranteed empower (+4):  ' +
            (level + 14)
        );
      }
    }
    return true;
  });
};
