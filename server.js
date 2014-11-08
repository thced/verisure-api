// let get rid of callbacks
require('es6-promise').polyfill();

var restify = require('restify');
var request = require('request');
var config = require('./config');

var alarmStatus = {},
	climateData = {};

var alarmFields = [ 'status' ],
	climateFields = [ 'location', 'humidity', 'temperature', 'timestamp' ];

// form data from login form - some hidden fields weren't needed
var formData = {
	j_username: config.username,
	j_password: config.password
};


// enabling cookies
request = request.defaults({ jar: true });


function requestPromise ( options ) {
	return new Promise( function ( resolve, reject ) {
		request( options, function requestCallback( error, response, body ) {

			// handle reponse errors
			if ( options.json && response.headers['content-type'] == 'text/html;charset=UTF-8' )
				error = { status: 'error', message: 'Expected JSON, but got html' };
			else if ( body.status == 'error' )
				error = body;

			// resolve / reject
			if ( error ) reject( error );
			else resolve( body );
		});
	});
}

function authenticate () {
	var auth_url = config.domain + config.auth_path;
	return requestPromise({ url: auth_url, form: formData, method: 'POST', json: true });
}

function getAlarmStatus () {
	var alarmstatus_url = config.domain + config.alarmstatus_path + Date.now();
	return requestPromise({ url: alarmstatus_url, json: true });
}

function getClimateData () {
	var climatedata_url = config.domain + config.climatedata_path + Date.now();
	return requestPromise({ url: climatedata_url, json: true });
}

function getData () {
	return Promise.all([ getAlarmStatus(), getClimateData() ]);
}

function parseData ( data ) {
	var alarmRawData = data[ 0 ][ 0 ],
		climateRawData = data[ 1 ];

	alarmStatus = filterByKeys( alarmRawData, alarmFields );
	climateData = climateRawData.map( function ( dataSet ) {
		return filterByKeys( dataSet, climateFields );
	});

	console.log( 'alarmStatus', alarmStatus );
	console.log( 'climateData', climateData );
}

function onError ( err ) {
	console.log( 'Nay', err );
}


authenticate()
	.then( getData )
	.then( parseData )
	.catch( onError );

/*

function respond(req, res, next) {
	res.send('hello ' + req.params.name);
	next();
}

var server = restify.createServer();
server.get('/hello/:name', respond);
server.head('/hello/:name', respond);

server.listen(8080, function() {
	console.log('%s listening at %s', server.name, server.url);
});

*/

function filterByKeys ( obj, keysArr ) {
	var filtered = {};

	function filter ( key ) {
		if ( keysArr.indexOf( key ) != -1 ) filtered[ key ] = obj[ key ];
	}
	Object.keys( obj ).forEach( filter );

	return filtered;
}

