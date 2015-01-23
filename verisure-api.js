/*
	TODO: sanity check, require user/pass
 */



var request = require('request');
// ES6 object cloning
var objectAssign = require('object-assign');
// ES6 Promises
require('es6-promise').polyfill();

var formData, firstAlarmPoll, firstClimatePoll,
	authenticated = false,
	config = {},
	alarmStatus = {},
	climateData = {},
	listeners = {
		climateChange: [],
		alarmChange: []
	};

var defaults = {
	username: '',
	password: '',
	domain: 'https://mypages.verisure.com',
	auth_path: '/j_spring_security_check?locale=sv_SE',
	alarmstatus_path: '/remotecontrol?_=',
	climatedata_path: '/overview/climatedevice?_=',
	alarmFields: [ 'status', 'date' ],
	climateFields: [ 'location', 'humidity', 'temperature', 'timestamp' ]
};

// request timeouts
var alarmFetchTimeout = 30 * 1000,			// 0.5 min
	climateFetchTimeout = 30 * 60 * 1000, 	// 30 min
	errorTimeout = 10 * 60 * 1000; 			// 10 min

// enabling cookies
request = request.defaults({ jar: true });

/* UTILITY */

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
		if ( keysArr.indexOf( key ) !== -1 ) {
			filtered[ key ] = obj[ key ];
		}
	}
	Object.keys( obj ).forEach( filter );

	return filtered;
}

/**
 * Function to dispatch change event for a service
 * @param {String} service - service name
 * @param {Object} data - data to dispatch to listeners
 */
function dispatch( service, data ) {
	"use strict";

	listeners[ service ].forEach( function ( listener ) {
		listener( data );
	});
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
			// handle response errors
			if ( options.json && response.headers['content-type'] !== 'application/json;charset=UTF-8' ) {
				error = { state: 'error', message: 'Expected JSON, but got html' };
			} else if ( body.state === 'error' )	{
				error = body;
				authenticated = false;
			}

			// resolve / reject
			if ( error ) {
				reject( error );
			} else {
				authenticated = true;
				resolve( body );
			}
		});
	});
}

/* PRIVATE */

/**
 *
 * @returns {Promise}
 */
function authenticate () {
	'use strict';
	var auth_url = config.domain + config.auth_path,
		requestParams = {
			url: auth_url,
			form: formData,
			method: 'POST'
		};

	return authenticated ? Promise.resolve( true ) : requestPromise( requestParams );
}

/**
 *
 * @returns {Promise}
 */
function fetchAlarmStatus () {
	'use strict';

	var alarmstatus_url = config.domain + config.alarmstatus_path + Date.now();
	return requestPromise({ url: alarmstatus_url, json: true });
}

/**
 *
 * @returns {Promise}
 */
function fetchClimateData () {
	'use strict';

	var climatedata_url = config.domain + config.climatedata_path + Date.now();
	return requestPromise({ url: climatedata_url, json: true });
}

/**
 *
 * @param data
 * @returns {*}
 */
function parseAlarmData ( data ) {
	"use strict";

	data = filterByKeys( data[ 0 ], config.alarmFields );

	setTimeout( pollAlarmStatus, alarmFetchTimeout );

	// check for alarm data changes
	if ( JSON.stringify( data ) !== JSON.stringify( alarmStatus ) ) {
		alarmStatus = data;
		dispatch( 'alarmChange', data );
	}
	return Promise.resolve( data );
}

/**
 *
 * @param data
 * @returns {*}
 */
function parseClimateData ( data ) {
	'use strict';
	data = data.map( function ( dataSet ) {
		return filterByKeys( dataSet, config.climateFields );
	});

	setTimeout( pollClimateData, climateFetchTimeout );

	// check for climate data changes
	if ( JSON.stringify( data ) !== JSON.stringify( climateData ) ) {
		climateData = data;
		dispatch( 'climateChange', data );
	}
	return Promise.resolve( data );
}

function pollAlarmStatus () {
	'use strict';
	return fetchAlarmStatus().then( parseAlarmData );
}

function pollClimateData () {
	'use strict';
	return fetchClimateData().then( parseClimateData );
}

function gotAlarmStatus () {
	"use strict";
	return Object.keys( alarmStatus ).length !== 0;
}

function gotClimateData () {
	"use strict";
	return Object.keys( climateData ).length !== 0;
}

function getAlarmStatus() {
	"use strict";

	if ( gotAlarmStatus() ) {
		return Promise.resolve( alarmStatus );
	} else {
		return firstAlarmPoll;
	}
}

function getClimateData() {
	"use strict";

	if ( gotClimateData() ) {
		return Promise.resolve( climateData );
	} else {
		return firstClimatePoll;
	}
}

/**
 * Error handler. When either request causes an error, invalidate authentication and wait to avoid getting blocked
 * @param err
 */
function onError ( err ) {
	'use strict';

	setTimeout( engage, errorTimeout );
	config.onError( err );
}

function engage() {
	"use strict";

	firstAlarmPoll = authenticate()
		.then( pollAlarmStatus );
	firstClimatePoll = firstAlarmPoll
		.then( pollClimateData )
		.catch( onError );
}


/* PUBLIC */
var publicApi = {

	/**
	 * Function adds a change event listener to one of the services
	 * @param {String} service - name of service to watch for changes
	 * @param {Function} callback - function to execute on change
	 * @returns {Error} - if something goes wrong
	 */
	on: function( service, callback ) {
		"use strict";

		if ( !listeners[ service ] ) {
			return new Error( 'No such service! Subscribe to alarmChange or climateChange!' );
		}

		if ( typeof callback !== 'function' ) {
			return new Error( 'Please provide a function as callback' );
		}

		// we are already subscribed, but no reason to Error
		if ( listeners[ service ].indexOf( callback ) === -1 ) {
			listeners[ service ].push( callback );
		}

		if ( service === 'alarmChange' && gotAlarmStatus() ) {
			callback( alarmStatus );
		} else if ( service === 'climateChange' && gotClimateData() ) {
			callback( climateData );
		}
	},

	/**
	 * Function removes a change event listener for a specified service
	 * @param {String} service - name of service to stop listening to
	 * @param {Function=} callback - callback to remove or if not specified, all listeners to service will be removed
	 * @returns {Error} - if something goes wrong
	 */
	off: function( service, callback ) {
		"use strict";

		if ( !listeners[ service ] ) {
			return new Error( 'No such service! Unsubscribe from alarmChange or climateChange!' );
		}

		if ( typeof callback === 'function' ) {
			var i = listeners[ service ].indexOf( callback );
			if ( i !== -1 ) {
				listeners[ service ].splice( i, 1 );
			}
		} else if ( typeof callback === 'undefined' ) {
			listeners[ service ] = [];
		}
	},

	/**
	 * Function a promise for the recent value of the specified service
	 * @param service
	 * @returns {*}
	 */
	get: function( service ) {
		"use strict";

		if ( service === 'alarmStatus' ) {
			return getAlarmStatus();
		}
		if ( service === 'climateData' ) {
			return getClimateData();
		}

		return Promise.reject( 'No such service! Use alarmStatus or climateData' );
	}
};

/**
 * Verisure api requires username & pass for setup, will then return public api
 * @param {Object} options - config options containing at least username & password
 * @returns {{on: on, off: off, get: get}}
 */
function setup ( options ) {
	"use strict";

	config = objectAssign( defaults, options );

	if ( !config.username && !config.password ) {
		throw "Missing required username and password for verisure api";
	}

	// form data for login
	formData = {
		j_username: config.username,
		j_password: config.password
	};

	engage();

	return publicApi;
}

module.exports.setup = setup;