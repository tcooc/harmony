const timeDiffToString = require('lib').timeDiffToString;
const getResponse = require('lib/bot').getResponse;

const MAINTENANCE_REGEX = /Maintenance (\w{3,6}):.*data-time="([^"]+)"/m;
const URL = 'https://exvius.gamepedia.com/Update_Schedule';

function getMaintenanceData() {
	return getResponse(URL).then(response => {
		const body = response.body.toString();
		const match = MAINTENANCE_REGEX.exec(body);
		if(!match) {
			throw new Error('No match from wiki');
		}
		const verb = match[1];
		const time = new Date(match[2]).getTime();
		return {
			verb: verb,
			time: time,
		};
	});
}

module.exports = messaging => {
	messaging.addCommandHandler(/^!ffbe/i, (message, content) => {
		getMaintenanceData().then(data => {
			const timeDiff = data.time - Date.now();
			if(timeDiff > 0) {
				messaging.send(message, 'Maintenance ' + data.verb + ' in ' + timeDiffToString(timeDiff));
			} else {
				messaging.send(message, 'Maintenance ' + data.verb.replace(/s$/, '') + 'ed');
			}
		}, () => messaging.send(message, 'Status unknown'));
		return true;
	});
};
