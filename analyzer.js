const debug = require('debug')('analyzer');
const _ = require('underscore');
const util = require('util');
const filesystem = require('fs');

const fs = {
	readFile: util.promisify(filesystem.readFile)
};

const task_loadCache = function(userId) {
	return fs.readFile(userId + '.json')
	.then(function(data) {
		return new Promise(function(resolve, reject) {
			try
			{
				debug("Parsing JSON");
				resolve(JSON.parse(data));
				debug("Parsed JSON");
			}
			catch (err)
			{
				reject(err);
			}
		});
	}, function(err) {
		console.log('failed', err);
	});
}

const analyze = function(data) {
	var stats = {
		totalGames: 0,
		gamesWithAchievements: 0,
		// Most played game based on 'playtime_forever'
		mostPlayed: null,
		// Total time spent playing games
		totalPlayTime: 0,
		// Total games unplayed based on 'playtime_forever'
		unplayed: 0,
		// Total games in which no achievements have been attained
		notStarted: 0,
		// Total achievements available across all games
		totalAchievements: 0,
		// Total achievements attained
		achievementsAttained: 0,
		// Latest achievements
		latestAchievements: [],
		// Total games where all achievements have been attained
		perfectGames: 0,
		// Overall completion percentage
		completionPercentage: 0,
	};

	var gameAnalysis = {
		mostAchievements: null,
		leastAchievements: null,
		easiestGames: [],
		easiestAchievements: []
	}

	const recordLatestAchievements = function(achievement) {

	}

	const recordEasiestGames = function(game, lowestGlobalPercentage) {
		if (game.appid === 659850) return;

		var easiestGames = gameAnalysis.easiestGames

		var remove = _.find(easiestGames, function(easiestGame) {
			return (easiestGame.lowestGlobalPercentage < lowestGlobalPercentage);
		});

		if (remove)
		{
			easiestGames.splice(_.indexOf(easiestGames, remove), 1);
		}

		if (easiestGames.length < 10)
		{
			var add = _.pick(game, 'appid', 'gameName', 'playtime_forever');
			add.lowestGlobalPercentage = lowestGlobalPercentage;
			easiestGames.push(add);

			// TODO remove game achievements from gameAnalysis.easiestAchievements
		}
	}

	const recordEasiestAchievements = function(game, achievement) {
		if (game.appid === 659850) return;

		var easiestAchievements = gameAnalysis.easiestAchievements;

		var remove = _.find(easiestAchievements, function(easiestAchievement) {
			return (easiestAchievement.globalCompletionPercentage < achievement.globalCompletionPercentage);
		});

		if (remove)
		{
			easiestAchievements.splice(_.indexOf(easiestAchievements, remove), 1);
		}

		if (easiestAchievements.length < 10)
		{
			var add = _.pick(game, 'appid', 'gameName', 'playtime_forever');
			add.achievementName = achievement.displayName;
			add.globalCompletionPercentage = achievement.globalCompletionPercentage;
			easiestAchievements.push(add);
		}
	}

	// Total game achievement completion percentage
	var totalPercentage = 0;
	stats.totalGames = data.length;

	_.each(data, function(game) {
		// Count unplayed (inaccurate for games which existed before Steam recorded play time)
		if (game.playtime_forever === 0)
		{
			++stats.unplayed;
		}
		else
		{
			stats.totalPlayTime += game.playtime_forever;

			// Remember the most played game
			if (!stats.mostPlayed || stats.mostPlayed.playtime_forever < game.playtime_forever)
			{
				stats.mostPlayed = _.pick(game, 'appid', 'gameName', 'playtime_forever');
			}
		}

		if (game.achievements)
		{
			++stats.gamesWithAchievements;
			stats.totalAchievements += game.achievements.length;

			var gameAchievementsAttained = 0;
			// Lowest global percentage (hardest achievement in the game)
			var lowestGlobalPercentage;
			_.each(game.achievements, function(achievement) {
				if (achievement.achieved)
				{
					++gameAchievementsAttained;
					++stats.achievementsAttained;

					recordLatestAchievements(achievement);
				}
				else
				{
					recordEasiestAchievements(game, achievement);
				}

				if (!lowestGlobalPercentage || lowestGlobalPercentage > achievement.globalCompletionPercentage)
				{
					lowestGlobalPercentage = achievement.globalCompletionPercentage;
				}
			});

			if (gameAchievementsAttained === game.achievements.length)
			{
				++stats.perfectGames;
			}
			else
			{
				recordEasiestGames(game, lowestGlobalPercentage);

				if (0 === gameAchievementsAttained)
				{
					++stats.notStarted;
				}
				else
				{
					var percent = Math.round(game.achievements.length / gameAchievementsAttained);
					totalPercentage += percent;
				}
			}

			if (!gameAnalysis.mostAchievements || gameAnalysis.mostAchievements.achievementCount < game.achievements.length)
			{
				gameAnalysis.mostAchievements = _.pick(game, 'appid', 'gameName', 'playtime_forever');
				gameAnalysis.mostAchievements.achievementCount = game.achievements.length;
			}

			if (!gameAnalysis.leastAchievements || gameAnalysis.leastAchievements.achievementCount > game.achievements.length)
			{
				gameAnalysis.leastAchievements = _.pick(game, 'appid', 'gameName', 'playtime_forever');
				gameAnalysis.leastAchievements.achievementCount = game.achievements.length;
			}
		}
	});

	stats.completionPercentage = Math.floor(totalPercentage / (stats.gamesWithAchievements - stats.notStarted));

	console.log(stats);
	console.log(gameAnalysis);

	return new Promise(function(resolve, reject) {
		resolve(stats, gameAnalysis);
	});
}

module.exports = {
	analyzeFromCache: function(userId) {
		return task_loadCache(userId)
		.then(this.analyze)
		.catch(function(err) {
			debug('Caught', err);
		});
	},
	analyze: analyze
}

// Test
// module.exports.analyzeFromCache('<userId>');
