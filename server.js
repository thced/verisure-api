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



var login_url = config.domain + config.login_path;
var alarmstatus_url = config.domain + config.alarmstatus_path + Date.now();
var climatedata_url = config.domain + config.climatedata_path + Date.now();


// authenticate
request.post({ url: login_url, form: formData }, function optionalCallback(err, httpResponse, body) {
	if (err) {
		return console.error( 'upload failed:', err );
	}
	console.log( 'Server responded with:', body );

	// get alarm status
	request( alarmstatus_url, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			console.log( 'remotecontrol', body );
		}
	});

	// get climate data
	request( climatedata_url, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			console.log( 'climatedevice', body );
		}
	});
});



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