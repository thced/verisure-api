verisure-api
============
creating a basic module to poll verisure api to be able to trigger home automation based on alarm status changes


Usage:

    var config = {
	    username: 'yourverisure@email.com',
	    password: 'yourverisurepassword'
    };


    var verisureApi = require('./verisure-api').setup( config );


    // alarm state changes
    verisureApi.on( 'alarmChange', log );

    // climate measurement changes
    verisureApi.on( 'climateChange', log );

    function log ( data ) {
    	console.log( data );
    }