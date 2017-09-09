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
				var requiredGames = [];

				_.each(user.data, function(game, key) {
					if (!_.has(games.data, key))
					{
						// add the game to the game data as the game name is more reliable from the user data
						games.data[key] = {
							gameName: game.name
						};

						requiredGames.push({
							appid: key
						});
					}
					else if (_.isUndefined(games.data[key].achievements))
					{
						console.log("need", key, games.data[key]);
						process.exit();
						requiredGames.push({
							appid: key
						});
					}
				});

				return games.getSchemaForGames(options.key, requiredGames)
				.then(function() {
					return games.getGlobalAchievementsForGames(options.key, requiredGames);
				})
				.then(function() {
					return games.save()
				})
				.catch(function(err) {
					console.error("Failed to update game store");
					console.error(err);
				});
			})
			.catch(function(err) {
				console.error("Failed to update data.");
				console.error(err);
			});
		}
		else
		{
			_.defer(function() {
				var analyzer = new Analyzer(user, games);
				// Display the user summary
				console.log("Statistics:");
				_.each(analyzer.statistics, function(value, key) {
					console.log(value, key);
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
				// console.log(easiestAchievements);
				_.each(easiestAchievements, function(group, key) {
					console.log(" - %s (%i)", group[0].gameName, group[0].id);
					_.each(group, function(item) {
						console.log("   %s (%s%%)", item.name, item.globalCompletionPercentage.toFixed(2));
					});
				});
				console.log("");
			});
		}
	})
	.catch(function(err) {
		console.error("Failed to initialize game store or user");
		console.error(err);
	});
}
