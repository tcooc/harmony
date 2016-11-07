const Playable = require('./Playable');

class UrlPlayable extends Playable {
	constructor(url, output) {
		super(output);
		this.url = url;
	}

	toString() {
		return this.url;
	}
}

module.exports = UrlPlayable;
