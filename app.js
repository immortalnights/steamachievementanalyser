const cmdLineArgs = require('./lib/cmdlineargs');
const Player = require('./lib/player');
const DataStore = require('./lib/datastore');
const Analyzer = require('./lib/analyzer');
const Steam = require('./lib/steam');
// const moment = require('moment');
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

var task_GetPlayerAchievementsForGames = function(user, games) {
	console.log("Get user achievements for %i game(s)...", games.length);

	var self = this;
	return new Promise(function(resolve, reject) {
		var failures = 0;
		var check = _.after(games.length, function() {
			// reject parent promise if all requests failed
			if (games.length === failures)
			{
				reject();
			}
			else
			{
				resolve(games);
			}
		});

		// Some requests may fail if the game no longer exists or has no associated data
		// if the game does not have achievements it should be marked so that it's not requested again
		var requests = _.map(games, function(game) {
			return self.getPlayerAchievementsForGame(user, game)
			.then(check)
			.catch(function(err) {
				++failures;
				check();
			});
		});
	});
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
			var steam = new Steam(options.key);
			
			console.log("Retrieving owned games...");
			steam.getOwnedGames(user.id)
			.then(function(ownedGames) {
				// fetch any / all games which the user has, which the data store does not have
				// TODO fetch any games which are over 1 month old
				// Identify new games for statistical purposes
				// TODO determine how long ago the data was refreshed and remember the game count change
				var newGames = _.filter(ownedGames, function(game) { return !_.has(user.data, game.appid); });
				console.log("Identified", newGames.length, "new games.");

				// Add all new games to the user data
				_.each(newGames, function(game) {
					user.data[game.appid] = _.omit(game, 'appid');
				});

				// If the user has played them, get their achievement information
				var requiredGames = _.filter(newGames, function(game) { return game.playtime_forever !== 0; });

				var promise;
				if (!_.isEmpty(requiredGames))
				{
					promise = task_GetPlayerAchievementsForGames.call(steam, user.id, requiredGames)
					.then(function(game) {
						_.each(games, function(game) {
							// update the game data
							_.extend(user.data[game.appid], _.omit(game, 'appid'));
						});

						console.log("Saving updated user data...");
						return user.save().catch(function(err) {
							console.error("Failed to save updated user data!", err)
						});
					})
					.catch(function(err) {
						console.error("Failed to retrieve any game achievement data");
					});
				}

				return promise;
			})
			.then(function() {
				console.log("")
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
