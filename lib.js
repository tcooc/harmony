var SEGMENTS = 2;

var DIVIDE = [
	86400000, // day
	3600000, // hour
	60000, // minute
	1000 // second
];

var TIME = [
	'Day',
	'Hour',
	'Minute',
	'Second'
];

exports.getTimestamp = function getTimestamp(dateObj) {
	return (+dateObj.$date.$numberLong);
};

// Precondition: timeDiff >= 0, otherwise will just return "Now"
exports.timeDiffToString = function timeDiffToString(timeDiff, segments) {
	segments = segments || SEGMENTS;
	if(timeDiff < DIVIDE[DIVIDE.length - 1]) {
		return 'Now';
	}
	var diffSplit = [];
	for(var i = 0; i < DIVIDE.length; i++) {
		diffSplit[i] = Math.floor(timeDiff / DIVIDE[i]);
		timeDiff -= diffSplit[i] * DIVIDE[i];
	}
	var tArr = [];
	for(i = 0; i < DIVIDE.length && tArr.length < segments; i++) {
		if(diffSplit[i] > 0) {
			tArr.push(diffSplit[i] + ' ' + TIME[i] + (diffSplit[i] > 1 ? 's' : ''));
		}
	}
	return tArr.join(', ');
};
