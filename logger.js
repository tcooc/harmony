const util = require('util');
const { SPLAT } = require('triple-beam');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;

const formatMeta = (meta) => {
  return meta[SPLAT] ? util.inspect(meta, { depth: 1, colors: true }) : '';
};

const myFormat = printf(({ level, message, label, timestamp, ...meta }) => {
  return `${timestamp} ${level}: ${message} ${formatMeta(meta)}`;
});

const logger = createLogger({
  format: combine(timestamp(), myFormat),
  transports: [new transports.Console()]
});

module.exports = {
  logger
};
