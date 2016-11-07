const child_process = require('child_process');
const UrlPlayable = require('./UrlPlayable');

class TwitchPlayable extends UrlPlayable {
	play() {
		this.process = child_process.spawn('livestreamer', [this.url, 'worst', '--stdout'], {stdio: ['ignore', 'pipe', 'ignore']});
		this.stream = this.process.stdout;
	}

	stop() {
		this.stream.unpipe();
		this.process.kill('SIGINT');
	}
}

module.exports = TwitchPlayable;
