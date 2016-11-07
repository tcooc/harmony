const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const Playable = require('./Playable');

class FilePlayable extends Playable {
	constructor(filePath, output) {
		super(output);
		this.filePath = filePath;
	}

	play() {
		this.stream = fs.createReadStream(this.filePath);
	}

	stop() {
		this.stream.close();
	}

	toString() {
		return '[File]';
	}
}

module.exports = FilePlayable;
