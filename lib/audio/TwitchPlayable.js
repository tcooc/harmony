const child_process = require('child_process');
const UrlPlayable = require('./UrlPlayable');

class TwitchPlayable extends UrlPlayable {
	constructor(url, clientId, output) {
		super(url, output);
		this.clientId = clientId;
	}

	play() {
		var opts = [this.url, 'worst', '--stdout', '--http-header', 'Client-ID=' + this.clientId];
		this.process = child_process.spawn('livestreamer', opts, {stdio: ['ignore', 'pipe', 'ignore']});
		this.stream = this.process.stdout;
	}

	stop() {
		this.stream.unpipe();
		this.process.kill('SIGINT');
	}
}

module.exports = TwitchPlayable;
