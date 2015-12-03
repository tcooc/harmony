
function Timeout(ms, callback) {
	this.ms = ms;
	this.callback = callback;
	this.id = null;
}

function timeoutHandler() {
	this.id = null;
	this.callback();
}

Timeout.prototype.start = function() {
	if(!this.id) {
		this.id = setTimeout(timeoutHandler.bind(this), this.ms);
	}
	return this;
};

Timeout.prototype.stop = function() {
	if(this.id) {
		clearTimeout(this.id);
		this.id = null;
	}
	return this;
};

Timeout.prototype.restart = function() {
	this.stop();
	this.start();
	return this;
};

module.exports = Timeout;
