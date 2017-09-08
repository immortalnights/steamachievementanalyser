const cmdLineArgs = require('./lib/cmdlineargs');
const Player = require('./lib/player');
const DataStore = require('./lib/datastore');
const Analyzer = require('./lib/analyzer');
const _ = require('underscore');

const cmdLine = cmdLineArgs('title', 'description', [
	{
		name: 'user',
		alias: 'u',
		typeLabel: 'arg',
		description: 'User ID',
		defaultOption: true
	},
	{
		name: 'key',
		typeLabel: 'arg',
		description: 'Steam private API key'
	},
	{
		name: 'refresh',
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
		var analyzer = new Analyzer(this._player, this._games);
		// Display the user summary
		console.log("Statistics:");
		_.each(analyzer.statistics, function(value, key) {
			console.log("%s %s", value, key);
		});
		console.log("");
		// Display the ten easiest games
		console.log("Easiest Games:");
		var easiestGames = analyzer.getEasiestGames();
		_.each(easiestGames, function(item) {
			console.log(" - %s (%i): %s%%", item.name, item.id, item.globalCompletionPercentage.toFixed(2));
		});
		console.log("");
		// Display the ten easiest achievements
		console.log("Easiest Achievements:");
		var easiestAchievements = analyzer.getEasiestAchievements(false);
		_.each(easiestAchievements, function(item) {
			console.log(" - %s (%i)", item.gameName, item.id);
			console.log("   %s (%s%%)", item.name, item.globalCompletionPercentage.toFixed(2));
		});
		console.log("");
	}

	refreshUser(key)
	{
		var promise = this._player.refresh(key);

		promise.then(() => {
			this._player.save();
		});

		return promise;
	}

	refreshDataStore(key, apps)
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
		if (!_.isEmpty(apps) && key)
		{
			promise = this._games.fetch(key, apps);
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

if (options.help || !options.user)
{
	console.log(cmdLine.usage());
}
else
{
	// Always have to load the initialize store
	let games = new DataStore('games.json');
	let user = new Player(options.user);

	Promise.all([games.load(), user.load()])
	.then(function(results, b) {
		let games = results[0];
		let user = results[1];

		if (options.key)
		{
			user.update(options.key)
			.then(function() {
				// Fetch game schema and global achievement percentages for all games the user has
				console.log("TODO");

			})
			.catch(function(err) {
				console.log("Failed to get user games.");
				console.log(err);
			});
		}
		else
		{
			_.defer(function() {
				var analyzer = new Analyzer(user, games);
				// Display the user summary
				console.log("Statistics:");
				_.each(analyzer.statistics, function(value, key) {
					console.log("%s %s", value, key);
				});
				console.log("");
				// Display the ten easiest games
				console.log("Easiest Games:");
				var easiestGames = analyzer.getEasiestGames();
				_.each(easiestGames, function(item) {
					console.log(" - %s (%i): %s%%", item.name, item.id, item.globalCompletionPercentage.toFixed(2));
				});
				console.log("");
				// Display the ten easiest achievements
				console.log("Easiest Achievements:");
				var easiestAchievements = analyzer.getEasiestAchievements(false);
				_.each(easiestAchievements, function(item) {
					console.log(" - %s (%i)", item.gameName, item.id);
					console.log("   %s (%s%%)", item.name, item.globalCompletionPercentage.toFixed(2));
				});
				console.log("");
			});
		}
	})
	.catch(function(err) {
		console.error("Failed to initialize game store or user");
		console.error(err);
	});

	// var app = new App();

	// app.init(, options.user)
	// .then(function() {
	// 	console.log("next");
	// 	var promise = null;

	// 	if (options.refresh)
	// 	{
	// 		if (options.apps)
	// 		{
	// 			promise = app.refreshDataStore(options.key, options.apps);
	// 		}
	// 		else if (options.user)
	// 		{
	// 			promise = app.refreshUser(options.key);
	// 		}
	// 		else
	// 		{
	// 			console.error("Must provide user or apps to refresh");
	// 		}
	// 	}
	// 	else
	// 	{
	// 		if (options.user)
	// 		{
	// 			app.analyzeUser();
	// 		}
	// 		else
	// 		{
	// 			console.error("Must provide user to analyze");
	// 		}
	// 	}

	// 	return promise;
	// })
	// .catch(function(err) {
	// 	console.log("Failed", err);
	// });


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
	// 			if (options.key)
	// 			{
	// 				player.refresh(options.key)
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
