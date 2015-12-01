var low = require('lowdb');
var db = low('.secrets');

module.exports = db;
