const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const Playable = require('./Playable');

class FilePlayable extends Playable {
  constructor(filePath, output) {
    super(output);
    this.filePath = filePath;
    this.name = filePath.split('/').pop();
  }

  play() {
    this.stream = fs.createReadStream(this.filePath);
  }

  stop() {
    this.stream.close();
  }

  toString() {
    return this.name;
  }
}

module.exports = FilePlayable;
