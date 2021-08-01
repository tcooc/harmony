var _ = require("underscore");
var events = require("events");
var logger = require("../logger");
var Promise = require("bluebird");
var request = Promise.promisifyAll(require("request"));
var db = require("../db");

function getStreamsRequest(clientid, token, channel) {
  if (Array.isArray(channel)) {
    channel = channel.join(",");
  }
  return {
    url: `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(
      channel
    )}`,
    headers: {
      Authorization: "Bearer " + token,
      "Client-ID": clientid,
    },
  };
}

module.exports = function (messaging, client) {
  var client_id = messaging.settings.twitch.client_id;
  var secret = messaging.settings.twitch.client_secret;
  var token = null;
  // map of stream->broadcast specs
  var channelWatchers;
  // channel status values: false, true, timestamp
  // if false, means that status hasn't been initiated
  // if true, means that status has been initiated, and stream was offline
  // if timestamp, means that status has been initiated, and stream was online
  var channelsStatus = {};

  var timeout;

  var eventBus = new events.EventEmitter();

  eventBus.on("update", function (name, stream) {
    var streaming = stream && stream.type === "live";
    if (streaming) {
      if (channelsStatus[name] && channelsStatus[name] !== stream.started_at) {
        eventBus.emit("statusChanged", name, stream, streaming);
      }
      channelsStatus[name] = stream.started_at;
    } else {
      channelsStatus[name] = channelsStatus[name] || true;
    }
  });

  eventBus.on("statusChanged", function (name, stream, streaming) {
    if (streaming) {
      var watchers = channelWatchers[name];
      _.each(watchers, function (watcher) {
        var channel = client.channels.get(watcher);
        logger.info("Stream started: " + stream.user_name + " " + stream.game);
        messaging.send(
          channel,
          "**" +
            stream.user_name +
            "** is now streaming " +
            stream.title +
            " @ https://www.twitch.tv/" +
            name
        );
      });
    }
  });

  // each spec has stream and broadcast
  function loadWatchers(specs) {
    channelWatchers = {};
    _.each(specs, function (spec) {
      if (!channelWatchers[spec.stream]) {
        channelWatchers[spec.stream] = [];
      }
      channelWatchers[spec.stream].push(spec.broadcast);
      channelsStatus[spec.stream] = channelsStatus[spec.stream] || false;
    });
  }

  async function getStreams() {
    if (!token) {
      const body = (
        await request.postAsync({
          url: `https://id.twitch.tv/oauth2/token?client_id=${client_id}&client_secret=${secret}&grant_type=client_credentials`,
        })
      ).body;
      logger.silly("token", body);
      token = JSON.parse(body);
      setTimeout(() => {
        token = null;
      }, token.expires_in);
    }

    return request
      .getAsync(
        getStreamsRequest(
          client_id,
          token.access_token,
          Object.keys(channelWatchers)
        )
      )
      .then(function (response) {
        logger.silly("getStreams", response.body);
        if (
          response.headers["content-type"] &&
          !response.headers["content-type"].startsWith("application/json")
        ) {
          logger.warn(
            "getStreams returned invalid content type, " +
              response.headers["content-type"]
          );
          return [];
        } else {
          return JSON.parse(response.body).data;
        }
      })
      .catch(function (error) {
        logger.error("getStreams error", error);
      });
  }

  function update() {
    return getStreams().then(function (streams) {
      var streamsMap = {};
      _.each(streams, function (stream) {
        streamsMap[stream.user_name.toLowerCase()] = stream;
      });
      _.each(channelWatchers, function (broadcast, name) {
        if (!streamsMap[name]) {
          streamsMap[name] = null;
        }
      });
      _.each(streamsMap, function (stream, name) {
        eventBus.emit("update", name, stream);
      });
      logger.silly("streamsMap", streamsMap);
      logger.silly("channelsStatus", channelsStatus);
    });
  }

  function updateLoop() {
    update().finally(function () {
      timeout = setTimeout(updateLoop, 30 * 1000);
    });
  }

  messaging.addCommandHandler(/^!twitch/i, function (message, content) {
    if (!messaging.hasAuthority(message)) {
      return;
    }
    var username = content[1];
    db.update(function (data) {
      var index = data.twitch.findIndex(
        (spec) => spec.broadcast === message.channel.id
      );
      if (index === -1) {
        index = data.twitch.length;
      }
      if (username) {
        data.twitch[index] = {
          stream: username.toLowerCase(),
          broadcast: message.channel.id,
        };
        messaging.send(
          message,
          "Channel following Twitch stream `" + username + "`"
        );
      } else {
        data.twitch.splice(index, 1);
        messaging.send(message, "Channel follow removed");
      }
      loadWatchers(data.twitch);
    });
    return true;
  });

  messaging.addCleanup(function () {
    clearTimeout(timeout);
  });

  db.get().then(function (data) {
    loadWatchers(data.twitch);
    updateLoop();
    logger.info("Twitch plugin started with spec.length=" + data.twitch.length);
  });
};
