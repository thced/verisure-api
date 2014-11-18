verisure-api
============
creating a basic module to poll verisure api to be able to trigger home automation based on alarm status changes


Usage:

var config = {
	username: 'yourverisure@email.com',
	password: 'yourverisurepassword',
	onData: function( data ) { console.log( 'We got data', data );
};


require('./verisure-api')( config );
