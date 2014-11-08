// let get rid of callbacks
require('es6-promise').polyfill();

var restify = require('restify');
var request = require('request');
var config = require('./config');



// form data from login form - some hidden fields weren't needed
var formData = {
	j_username: config.username,
	j_password: config.password,
	'spring-security-redirect': '/se/start.html'
};


// enabling cookies
request = request.defaults({ jar: true });


function requestPromise ( options ) {
	return new Promise( function ( resolve, reject ) {
		request( options, function requestCallback( error, response, body ) {
			if ( error ) reject( error );
			else resolve( body );
		});
	});
}

function authenticate () {
	var auth_url = config.domain + config.auth_path;
	return requestPromise({ url: auth_url, form: formData, method: 'POST' });
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

function saveData ( data ) {
	console.log( 'Yay', data );
}

function onError ( err ) {
	console.log( 'Nay', err );
}



authenticate()
	.then( getData )
	.then( saveData )
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