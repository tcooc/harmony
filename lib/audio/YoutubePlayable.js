const URL = require('url');
const ytdl = require('ytdl-core');
const UrlPlayable = require('./UrlPlayable');

const YTDL_OPTIONS = {
  quality: 'lowest',
  filter: function(format) {
    return format.container === 'mp4' && !!format.audioEncoding;
  }
};

const YOUTUBE_WATCH_URL = 'https://www.youtube.com/watch?v=';

class YoutubePlayable extends UrlPlayable {
  static toUrl(videoId) {
    return YOUTUBE_WATCH_URL + videoId;
  }

  play() {
    var url = URL.parse(this.url, true);
    var videoId = url.query ? url.query.v : null;
    var youtubeUrl = YoutubePlayable.toUrl(videoId);
    this.stream = ytdl(youtubeUrl, YTDL_OPTIONS);
    this.stream.on('info', info => {
      this.info = info;
    });
    return this.stream;
  }

  stop() {
    this.stream.unpipe();
    this.stream.end();
  }
}

module.exports = YoutubePlayable;
