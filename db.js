const Database = require('jdb');
var db;
if(require.main.filename.split('/').pop() === 'bot.js') {
	db = new Database({file: '.jdb.bot.json'});
} else {
	db = new Database();
}

module.exports = db;
