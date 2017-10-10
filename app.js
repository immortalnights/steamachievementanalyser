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
	.then(function(results) {
		let games = results[0];
		let user = results[1];

		if (options.key)
		{
			user.update(options.key)
			.then(function() {
				// Fetch game schema and global achievement percentages for all games the user has
				let requiredGames = [];

				_.each(user.data, function(userGame, key) {
					if (!_.has(games.data, key))
					{
						// add the game to the game data as the game name is more reliable from the user data
						games.data[key] = {
							gameName: userGame.name
						};

						requiredGames.push({
							appid: key
						});
					}
					else if (userGame.playtime_forever !== 0 && userGame.achievements && _.isUndefined(games.data[key].achievements))
					{
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
				let analyzer = new Analyzer(user, games);

				let statistics = analyzer.calculate();

				// Display the user summary
				console.log("Statistics:");
				console.log("Total Games:           %i (%s%% unplayed)", statistics.totalGames, ((statistics.unplayedGames / statistics.totalGames) * 100).toFixed(2));
				console.log("Perfected:             %i (%s%%)", statistics.perfectGames, ((statistics.perfectGames / statistics.totalGames) * 100).toFixed(2));
				console.log("Achievements:          %s%%", ((statistics.totalAchievedAchievements / statistics.totalAvailableAchievements) * 100).toFixed(2))
				console.log("Completion Percentage: %s%%", statistics.completionPercentage);

				console.log("");
				// console.log("Most Played Games:");
				// let mostPlayed = statistics.mostPlayedGame;
				// console.log(" - %s %ih", mostPlayed.gameName, mostPlayed.playtime_forever);
				// console.log("");
				// console.log("Recent Games:");
				// statistics.recentGames = _.sortBy(statistics.recentGames, 'playtime_forever');
				// _.each(statistics.recentGames, function(game) {
				// 	let playtime = game.playtime_forever;
				// 	if (playtime > 1500)
				// 	{
				// 		playtime = Math.round(playtime / 60 / 24) + 'd';
				// 	}
				// 	else if (playtime > 300)
				// 	{
				// 		playtime = Math.round(playtime / 60) + 'h';
				// 	}
				// 	else
				// 	{
				// 		playtime = playtime + 'm';
				// 	}

				// 	console.log(" - %s (%s) %s", game.gameName, game.appid, playtime);
				// });
				// console.log("");
				console.log("Highest Completion Percentage:");
				// Display the ten games with the least achievements remaining
				_.each(analyzer.getHighestCompletionPercentage(), function(game) {
					console.log(" - %s (%i) %s%", game.gameName, game.appid, game.percentage.toFixed(2));
				});
				console.log("");
				console.log("Lowest Completion Percentage:");
				// Display the ten games with the least achievements remaining
				_.each(analyzer.getLowestCompletionPercentage(), function(game) {
					console.log(" - %s (%i) %s%", game.gameName, game.appid, game.percentage.toFixed(2));
				});
				console.log("");
				// Display the ten easiest games
				console.log("Easiest Games:");
				let easiestGames = analyzer.getEasiestGames();
				easiestGames = _.sortBy(easiestGames, 'globalCompletionPercentage').reverse();
				_.each(easiestGames, function(item) {
					console.log(" - %s (%i): %s%%", item.name, item.id, item.globalCompletionPercentage.toFixed(2));
				});
				console.log("");
				// Display the ten easiest achievements
				console.log("Easiest Achievements:");
				let easiestAchievements = analyzer.getEasiestAchievements(false);
				easiestAchievements = _.sortBy(easiestAchievements, function(group) { return group[0].gameName; });
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
