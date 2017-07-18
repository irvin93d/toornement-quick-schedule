var request = require('request');
var fs = require('fs');
var waterfall = require('async/waterfall');
var cred = require('./credentials.json');
var BASE_URL = 'https://api.toornament.com';
var tournamentId;
var TOURNAMENT_NAME;
var rounds = [
	{simultaneousMatches: 6}, 
	{simultaneousMatches: 4},
	{simultaneousMatches: 4, pauseBefore: 50},
	{simultaneousMatches: 4},
	{simultaneousMatches: 1},
	{simultaneousMatches: 1}
]


function addMinutes(date,minutes) {
	return new Date(date.getTime() + minutes*60000);	
}

// Move into main
var options = {};
(function main() {
	options.tmtName = process.argv[2];
	options.firstStartTime = new Date(process.argv[3]);
	if(!options.tmtName) {
		console.error('Tournement name is missing!');
	}
	if(!options.firstStartTime.getTime()){
		console.error('Start time is missing');
	}

	// TODO: Remove below after everything is in main
	TOURNAMENT_NAME = options.tmtName;

}());

// Waterfall guarantees synchronous execution (each function will execute in order)
waterfall([
	// Get Access token
	(cb) => {
		request.post(BASE_URL + '/oauth/v2/token',{
			form: {
				'grant_type': 'client_credentials',
				'client_id': cred.client_id,
				'client_secret': cred.client_secret
			}
		},cb)
	},
	// Save Access Token
	(res, body, cb) => {
		if(res.statusCode === 200 && body){
			let json = JSON.parse(body);
			cred.access_token = json.access_token;
			console.log("Access Token Recieved");
			cb();
		} else {
			cb('Error getting token: ' + res.statusCode)
		}

	}, 
	// Grab tournament by name
	(cb) => {
		request.get(BASE_URL + '/v1/me/tournaments?name=' + TOURNAMENT_NAME, {
			'headers': {
				'X-Api-Key': cred.api_key,
				'Authorization': 'Bearer ' + cred.access_token
			}
		}, cb);
	}, 
	// Get tournament ID
	(res,body,cb) => {
		if(res.statusCode == 200 && body){
			let json = JSON.parse(body);
			tournamentId = json[0] && json[0].id;
			if(tournamentId){
				console.log('Tournament found: ' + json[0].name);
				cb()
			} else{
				cb('No tournament ID found');
			}
		} else {
			console.log('Failed getting tournament, code: ' + res.statusCode);
		}
	},
	// Get matches from selected tournament
	(cb) => {
		request.get(BASE_URL + '/v1/tournaments/'  + tournamentId + '/matches', {
			'headers': {
				'X-Api-Key': cred.api_key,
				'Authorization': 'Bearer ' + cred.access_token
				
			}
		}, cb);
	},
	(res,body,cb) => {
		if(res.statusCode === 200 && body){
			let matches = JSON.parse(body);
			
			let noMatches = matches.length;
			console.log(noMatches + ' games total');

			let makePatchBody = (date,matchIndex) => {
				// date on format "2015-09-06T00:10:00-0600"
				return {
					'date': date.toISOString().substring(0,19) + '-0000',
					'notes': 'Match ' + matchIndex+1
				}
			};

			// Recursive loop to reduce number of requests per second
			let doPatchLoop = (matchIndex,date) => {
				if(matchIndex >= noMatches) {
					cb();
					return;
				}
				let match = matches[matchIndex];
				let matchNumber = match.number;
				let roundNumber = match.round_number;
				let simultaneousMatches = rounds[roundNumber-1].simultaneousMatches;
				let pauseBefore = rounds[roundNumber-1].pauseBefore;
				if(matchIndex && !((matchNumber - 1) % simultaneousMatches)) {
					date = addMinutes(date, 25);
				}
				if(!(matchNumber-1) && pauseBefore) {
					date = addMinutes(date, pauseBefore);
				}

				let matchId = match.id;
				request.patch(
					BASE_URL + '/v1/tournaments/' + tournamentId
					+ '/matches/' + matchId, 
				{
					'headers': {
						'X-Api-Key': cred.api_key,
						'Authorization': 'Bearer ' + cred.access_token
					},
					'form': JSON.stringify(makePatchBody(date,matchIndex))
				},
				(err, res, body) => {
					if(res.statusCode === 200) {
						console.log('Success patching match index: ' + matchIndex);
						doPatchLoop(matchIndex+1, date);
					} else {
						console.log('Patch error on match index ' + matchIndex + ': ');
						console.log('StatusCode: ' + res.statusCode);
						if(body)
							console.log(JSON.parse(body));
					}
				});
			}

			doPatchLoop(0, options.firstStartTime);// new Date('2017-10-06 12:00:00'));

		} else{
			console.log('Error code: ' + res.statusCode);
		}
	}
],function(err){
	if(!err)
		console.log('dope, shit works');
	else
		console.log(err);
}
);
