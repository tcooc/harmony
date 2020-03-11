module.exports = function(messaging) {
  messaging.addCommandHandler(/^soon/i, function(message) {
    messaging.send(message, 'Soon' + String.fromCharCode(8482));
    return true;
  });

  messaging.addCommandHandler(/^!unflip/i, function(message) {
    messaging.send(message, '┬─┬ ◟(`ﮧ´ ◟ )');
    return true;
  });

  messaging.addCommandHandler(/^!flip/i, function(message) {
    messaging.send(message, '(╯°□°）╯︵ ┻━┻');
    return true;
  });
};
