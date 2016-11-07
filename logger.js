const util = require('util');
const winston = require('winston');

function formatMeta(meta) {
	return meta && Object.keys(meta).length ? util.inspect(meta, {depth: 1, colors: true}) : null;
}

const consoleTransport = new (winston.transports.Console)({
	timestamp: function() {
		return new Date().toISOString();
	},
	formatter: function(options) {
		var message = (options.message !== undefined ? options.message : '');
		var meta = formatMeta(options.meta);
		return options.timestamp() + ' ' + options.level.toUpperCase() + ' ' + message + (meta ? '\n' + meta : '');
	}
});

module.exports = new (winston.Logger)({transports: [consoleTransport]});
