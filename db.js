const Database = require('jdb');
if(require.main.filename.split('/').pop() === 'bot.js') {
	module.exports = new Database({file: '.jdb.bot.json'});
} else {
	module.exports = new Database();
}
