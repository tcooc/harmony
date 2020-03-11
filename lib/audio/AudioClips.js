const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');

function walk(filePath, memo) {
  return fs
    .statAsync(filePath)
    .then(function(stat) {
      if (stat.isDirectory()) {
        return fs.readdirAsync(filePath);
      } else {
        memo.push(filePath);
      }
    })
    .then(function(dirPaths) {
      return dirPaths
        ? Promise.all(
            dirPaths.map(dirPath => walk(path.resolve(filePath, dirPath), memo))
          )
        : dirPaths;
    })
    .then(function() {
      return memo;
    });
}

class AudioClips {
  constructor(basePath) {
    this.basePath = path.resolve(basePath);
    this.files = null;
  }

  load() {
    this.ready = walk(this.basePath, []).then(files => {
      files.sort();
      this.files = files;
      return this;
    });
    return this.ready;
  }
}

module.exports = AudioClips;
