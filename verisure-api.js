/*
	TODO: sanity check, require user/pass
 */

var request = require('request');
//  ES6 object cloning
var objectAssign = require('object-assign');
// ES6 Promises
require('es6-promise').polyfill();

var formData,
	authenticated = false,
	config = {},
	alarmStatus = {},
	climateData = {};

var defaults = {
	username: '',
	password: '',
	domain: 'https://mypages.verisure.com',
	auth_path: '/j_spring_security_check?locale=sv_SE',
	alarmstatus_path: '/remotecontrol?_=',
	climatedata_path: '/overview/climatedevice?_=',
	alarmFields: [ 'status', 'date' ],
	climateFields: [ 'location', 'humidity', 'temperature', 'timestamp' ],
	onData: function ( data ) { console.log( data ); },
	onError: function ( err ) { console.log( err ); }
};

// request timeouts
var defaultTimeout = 60 * 1000, 	// 1 min
	errorTimeout = 10 * 60 * 1000; 	// 10 min

// enabling cookies
request = request.defaults({ jar: true });

/**
 * Utility function to filter out unwanted object properties by key
 * @param {Object} obj - Object to be filtered
 * @param {Array} keysArr - Array of keys to keep
 * @returns {Object} - New, filtered object containing keys keysArr
 */
function filterByKeys ( obj, keysArr ) {
	'use strict';
	var filtered = {};

	function filter ( key ) {
		if ( keysArr.indexOf( key ) != -1 ) filtered[ key ] = obj[ key ];
	}
	Object.keys( obj ).forEach( filter );

	return filtered;
}

/**
 * Request promise
 * @param {Object} options - options for request (url, method, .. etc)
 * @returns {Promise} - promise for the request
 */
function requestPromise ( options ) {
	'use strict';
	return new Promise( function ( resolve, reject ) {
		request( options, function requestCallback( error, response, body ) {

			// handle reponse errors
			if ( options.json && response.headers['content-type'] != 'application/json;charset=UTF-8' )
				error = { status: 'error', message: 'Expected JSON, but got html' };
			else if ( body.status == 'error' )	{
				error = body;
				authenticated = false;
			}

			// resolve / reject
			if ( error ) {
				reject( error );
			}
			else {
				authenticated = true;
				resolve( body );
			}
		});
	});
}

/**
 *
 * @returns {Promise}
 */
function authenticate () {
	'use strict';
	var auth_url = config.domain + config.auth_path;
	return authenticated ? Promise.resolve( true ) : requestPromise({ url: auth_url, form: formData, method: 'POST' });
}

/**
 *
 * @returns {Promise}
 */
function getAlarmStatus () {
	'use strict';
	var alarmstatus_url = config.domain + config.alarmstatus_path + Date.now();
	return requestPromise({ url: alarmstatus_url, json: true });
}

/**
 *
 * @returns {Promise}
 */
function getClimateData () {
	'use strict';
	var climatedata_url = config.domain + config.climatedata_path + Date.now();
	return requestPromise({ url: climatedata_url, json: true });
}

/**
 *
 * @returns {*|Promise}
 */
function getData () {
	'use strict';
	return Promise.all([ getAlarmStatus(), getClimateData() ] ).then( parseData );
}

/**
 *
 * @param data
 */
function parseData ( data ) {
	'use strict';

	var alarmRawData = data[ 0 ][ 0 ],
		climateRawData = data[ 1 ],
		newAlarmStatus, newClimateData;

	newAlarmStatus = filterByKeys( alarmRawData, config.alarmFields );
	newClimateData = climateRawData.map( function ( dataSet ) {
		return filterByKeys( dataSet, config.climateFields );
	});

	setTimeout( engage, defaultTimeout );

	// check for alarm data changes
	if ( JSON.stringify( newAlarmStatus ) != JSON.stringify( alarmStatus ) ) {
		alarmStatus = newAlarmStatus;
		console.log( 'alarmStatus', alarmStatus );
		config.onData( objectAssign( {}, alarmStatus ));
	}

	// check for climate data changes
	if ( JSON.stringify( newClimateData ) != JSON.stringify( climateData ) ) {
		climateData = newClimateData;
		console.log( 'climateData', climateData );
		config.onData( objectAssign( {}, climateData ));
	}
}

/**
 *
 * @param err
 */
function onError ( err ) {
	'use strict';
	setTimeout( engage, errorTimeout );
	config.onError( err );
}

function engage() {
	authenticate()
		.then( getData )
		.catch( onError );
}

module.exports = function setup( options ) {
	config = objectAssign( defaults, options );

	// form data for login
	formData = {
		j_username: config.username,
		j_password: config.password
	};
	engage();
};