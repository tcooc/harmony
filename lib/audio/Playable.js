class Playable {
	constructor(output) {
		this.output = output;
		this.options = {};
		this.disabled = false;
		if(!this.play || !this.stop) {
			throw new Error('unimplemented');
		}
	}
}

module.exports = Playable;
