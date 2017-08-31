const cmdLineArgs = require('./lib/cmdlineargs');
const Player = require('./lib/player');
const DataStore = require('./lib/datastore');
const _ = require('underscore');

const cmdLine = cmdLineArgs('title', 'description', [{
		name: 'user',
		alias: 'u',
		typeLabel: 'arg',
		description: 'User ID',
		defaultOption: true
	},
	{
		name: 'apps',
		alias: 'a',
		typeLabel: 'args',
		description: 'App IDs',
		type: function(value) {
			return value === '*' ? value : Number(value);
		},
		multiple: true
	},
	{
		name: 'privateKey',
		typeLabel: 'arg',
		description: 'Steam private API key'
	},
	{
		name: 'refresh',
		description: '',
		type: Boolean
	},
	{
		name: 'analyze',
		description: '',
		type: Boolean
	},
	{
		name: 'help',
		alias: 'h',
		description: 'Print this usage guide.'
	}
]);

const options = cmdLine.parse();

class App
{
	constructor()
	{
		this._games = null;
		this._player = null;
	}

	init(storeName, userId)
	{
		// initialize game data store
		this._games = new DataStore(storeName);
		this._player;

		// load game data
		var promise = this._games.load();

		if (userId)
		{
			// load player data
			this._player = new Player(userId);
			promise = promise.then(() => {
				return this._player.load();
			});
		}

		return promise;
	}

	analyzeUser()
	{
		
	}

	refreshUser(privateKey)
	{
		var promise = this._player.refresh(privateKey);

		promise.then(() => {
			this._player.save();
		});

		return promise;
	}

	refreshDataStore(privateKey, apps)
	{
		if (apps.length === 1 && apps[0] === '*')
		{
			if (this._player)
			{
				console.log("use player games");
				apps = _.keys(this._player.data);
			}
			else
			{
				console.log("use known games");
				// Refresh all games
				// apps = _.keys(this._games);
			}
		}

		// console.log("apps", apps);

		var promise;
		if (!_.isEmpty(apps) && privateKey)
		{
			promise = this._games.fetch(privateKey, apps);
		}
		else
		{
			if (_.isEmpty(apps))
			{
				promise = Promise.reject("Missing apps");
			}
			else
			{
				promise = Promise.reject("Missing Steam API key");
			}
		}

		promise.then(() => {
			this._games.save();
		});

		return promise;
	}
}



// console.log("Options", options);

if (options.help || !options.user && !options.apps)
{
	console.log(cmdLine.usage());
}
else
{
	var app = new App();

	app.init('games.json', options.user)
	.then(function() {
		console.log("next");
		var promise = null;

		if (options.refresh)
		{
			if (options.apps)
			{
				promise = app.refreshDataStore(options.privateKey, options.apps);
			}
			else if (options.user)
			{
				promise = app.refreshUser(options.privateKey);
			}
			else
			{
				console.error("Must provide user or apps to refresh");
			}
		}
		else if (options.analyze)
		{
			if (options.user)
			{
				app.analyzeUser();
			}
			else
			{
				console.error("Must provide user to analyze");
			}
		}

		return promise;
	})
	.catch(function(err) {
		console.log("Failed", err);
	});


	// if (options.apps)
	// {
	// 	games.load()
	// 	.then(function() {
	// 		if (options.refresh)
	// 		{
	// 			if (options.user)
	// 			{
	// 				var player = new Player(options.user);

	// 				player.load()
	// 				.then(function() {

	// 				});
	// 			}
	// 		}
	// 		else
	// 		{
	// 			// display game summary
	// 		}
	// 	});
	// }
	// else if (options.user)
	// {
	// 	var player = 
	// 	.then(function() {
	// 		if (options.refresh)
	// 		{
	// 			if (options.privateKey)
	// 			{
	// 				player.refresh(options.privateKey)
	// 				.then(function() {
	// 					return player.save();
	// 				})
	// 				.catch(console.error);
	// 			}
	// 			else
	// 			{
	// 				console.error("Steam API Key required");
	// 			}
	// 		}

	// 		if (options.analyze)
	// 		{
	// 			player.analyze();
	// 		}
	// 		else
	// 		{
	// 			// display user summary
	// 			const data = player.data;
	// 		}
	// 	});

	// }
	// else
	// {

	// }

// 	if (args.length === 1)
// 	{
// 		task = 'analyze';
// 	}
// 	else if (args.length === 2)
// 	{
// 		task = 'fetchAndAnalyze';
// 	}
// 	else if (args.length === 3)
// 	{
		
// 	}

// 	const task = task || args[0];
// 	const apiKey = args[1];
// 	const userId = args[2];

// 	switch (task)
// 	{
// 		case
		// case 'retrieveAndAnalyze':
		// {
		// 	console.log("Retrieving user game data");
		// 	loader.retrieveAndCache(apiKey, userId)
		// 	.then(function(data) {
		// 		console.log("Analyzing game data");
		// 		analyzer.analyze(data)
		// 		.then(function() {
		// 			console.log("Completed");
		// 		});
		// 	})
		// 	.catch(function(e) {
		// 		console.error("Error", e);
		// 	});
		// 	break;
		// }
		// case 'retrieve':
		// {
		// 	console.log("Retrieving user game data");
		// 	loader.retrieveAndCache(apiKey, userId)
		// 	.then(function() {
		// 		console.log("Completed");
		// 	})
		// 	.catch(console.error);
		// 	break;
		// }
		// case 'analyze':
		// {
		// 	console.log("Analyzing cached game data");
		// 	analyzer.analyzeFromCache(userId)
		// 	.then(function() {
		// 		console.log("Completed");
		// 	})
		// 	.catch(console.error);
		// 	break;
		// }
	// 	default:
	// 	{
	// 		console.error("Invalid task available 'retrieveAndAnalyze', 'retrieve', 'analyze'");
	// 		break;
	// 	}
	// }
}
