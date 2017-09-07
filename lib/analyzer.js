const debug = require('debug')('analyzer');
const _ = require('underscore');

module.exports = class Analyzer {
	constructor(user, games)
	{
		this._user = user;
		this._games = games;
	}

	// raw statistics
	get statistics()
	{
		var statistics = {
			totalGames: 0,
			playedGames: 0,
			unplayedGames: 0,
			mostPlayedGame: [],
			recentGames: [],
			totalPlayTime: 0,
			totalAvailableAchievements: 0,
			totalAchievedAchievements: 0,
			recentAchievements: [],
			perfectGames: 0,
			completionPercentage: 0
		};

		statistics.totalGames = _.keys(this._user.data).length;

		_.each(this._user.data, function(game) {
			if (game.playtime_forever)
			{
				++statistics.playedGames;
				statistics.totalPlayTime += game.playtime_forever;

				// Calculate the most played games
				// TODO
				// mostPlayedGame

				// Calculate recent games (using playtime_2weeks)
				// TODO
				// recentGames

				if (game.achievements)
				{
					var missingAchievements = game.achievements.length;
					statistics.totalAvailableAchievements += game.achievements.length;
					_.each(game.achievements, function(achievement) {
						if (achievement.achieved)
						{
							++statistics.totalAchievedAchievements;
							--missingAchievements;
						}

						// Calculate recent achievements
						// TODO
						// recentAchievements
					});

					if (missingAchievements === 0)
					{
						++statistics.perfectGames;
					}

					// calculate completionPercentage
					// TODO
					// completionPercentage 
				}
			}
			else
			{
				++statistics.unplayedGames;
			}
		});

		return statistics;
	}

	/**
	 * Owned games with the highest global completion percentage
	 */
	getEasiestGames()
	{
		var games = this.getGamesByCompletionPercentage();
		return games.splice(0, 10);
	}

	/**
	 * Outstanding achievements with highest global achievement percentage
	 */
	getEasiestAchievements(hasStarted)
	{
		var easiestAchievements = this.getAchievementsByCompletionPercentage();
		return easiestAchievements.splice(0, 10);
	}

	getGamesByCompletionPercentage()
	{
		var result = [];

		var gameStore = this._games;
		_.each(this._user.data, function(userGame, id) {
			const game = gameStore.data[id];

			if (game)
			{
				if (game.achievements)
				{
					var lowest = _.min(game.achievements, function(achievement) { return achievement.globalCompletionPercentage; });

					if (lowest.globalCompletionPercentage)
					{
						result.push({
							id: id,
							name: game.gameName.startsWith("ValveTestApp") ? userGame.gameName : game.gameName,
							globalCompletionPercentage: lowest.globalCompletionPercentage
						});

						// debug("game", game.gameName, "completion percentage", lowest.globalCompletionPercentage);
					}
				}
				else
				{
					debug("game", id, "does not have any achievements");
				}
			}
			else
			{
				// TODO - why not, deferrer loading them?
				debug("Failed to find game", id, "in game store");
			}
		});

		return _.sortBy(result, 'globalCompletionPercentage').reverse();
	}

	getAchievementsByCompletionPercentage(includeNotStarted)
	{
		var result = [];

		var gameStore = this._games;
		_.each(this._user.data, function(userGame, id) {
			const game = gameStore.data[id];

			if (game)
			{
				if (game.achievements)
				{
					if (userGame.playtime_forever !== 0 || includeNotStarted)
					{
						_.each(game.achievements, function(achievement) {

							// find the achievement in the user data
							var userAchievement = _.findWhere(userGame.achievements, { apiname: achievement.name });

							if (achievement.globalCompletionPercentage && !(userAchievement && userAchievement.achieved))
							{
								result.push({
									id: id,
									gameName: game.gameName.startsWith("ValveTestApp") ? userGame.gameName : game.gameName,
									name: achievement.displayName,
									globalCompletionPercentage: achievement.globalCompletionPercentage
								});
							}
						});
					}
				}
				else
				{
					debug("game", id, "does not have any achievements");
				}
			}
			else
			{
				// TODO - why not, deferrer loading them?
				debug("Failed to find game", id, "in game store");
			}
		});

		return _.sortBy(result, 'globalCompletionPercentage').reverse();
	}
}
