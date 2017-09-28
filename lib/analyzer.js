const debug = require('debug')('analyzer');
const _ = require('underscore');

const ignoreList = [235540 /* Vermintide */, 659850 /* GooCubelets_RGB */, 363970 /* Clicker Heroes */, 218620 /* Payday 2 */];

module.exports = class Analyzer {
	constructor(user, games)
	{
		this._user = user;
		this._games = games;
	}

	calculate()
	{
		let statistics = {
			totalGames: 0,
			playedGames: 0,
			unplayedGames: 0,
			mostPlayedGame: null,
			recentGames: [],
			totalPlayTime: 0,
			totalAvailableAchievements: 0,
			totalAchievedAchievements: 0,
			recentAchievements: [],
			perfectGames: 0,
			completionPercentage: 0
		};

		statistics.totalGames = _.keys(this._user.data).length;

		// Calculate the most played games
		// FIXME cannot get app id
		statistics.mostPlayedGame = _.pick(_.max(this._user.data, 'playtime_forever'), 'gameName', 'playtime_2weeks', 'playtime_forever');

		// used for completion percentage (has at least one achievement)
		let startedGames = 0;
		// sum of all started games completion percentage
		let totalCompletionPercentage = 0;

		_.each(this._user.data, function(game, key) {
			if (game.playtime_forever)
			{
				++statistics.playedGames;
				statistics.totalPlayTime += game.playtime_forever;

				// Calculate recent games (using playtime_2weeks)
				if (game.playtime_2weeks && game.playtime_2weeks > 0)
				{
					let recentGame = _.pick(game, 'gameName', 'playtime_2weeks', 'playtime_forever');
					recentGame.appid = key;
					statistics.recentGames.push(recentGame);
				}

				if (game.achievements)
				{
					let missingAchievements = game.achievements.length;
					statistics.totalAvailableAchievements += game.achievements.length;

					let gameAchievedAchievements = 0;
					_.each(game.achievements, function(achievement) {
						if (achievement.achieved)
						{
							++gameAchievedAchievements;
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

					if (gameAchievedAchievements > 0)
					{
						++startedGames;
						totalCompletionPercentage += (gameAchievedAchievements / game.achievements.length);
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

		statistics.achievementPercentage = ((statistics.totalAchievedAchievements / statistics.totalAvailableAchievements) * 100).toFixed(2);
		statistics.completionPercentage = ((totalCompletionPercentage / startedGames) * 100).toFixed(2);

		return statistics;
	}

	/**
	 * Owned games with the highest global completion percentage
	 */
	getEasiestGames()
	{
		let games = this.getGamesByCompletionPercentage();
		return games.splice(0, 10);
	}

	/**
	 * Outstanding achievements with highest global achievement percentage
	 */
	getEasiestAchievements(hasStarted)
	{
		let easiestAchievements = this.getAchievementsByCompletionPercentage();
		return _.groupBy(easiestAchievements.splice(0, 25), 'id');
	}

	getGamesByCompletionPercentage()
	{
		let result = [];

		let gameStore = this._games;
		_.each(this._user.data, function(userGame, id) {
			const game = gameStore.data[id];

			if (game)
			{
				if (game.achievements)
				{
					if (game.lowestGlobalCompletionPercentage)
					{
						// If the player has not played the game at all; it may not have any player achievement information
						if (!userGame.ignore && userGame.achievements && !_.every(userGame.achievements, function(item) { return item.achieved === 1; }))
						{
							result.push({
								id: id,
								name: game.gameName,
								globalCompletionPercentage: game.lowestGlobalCompletionPercentage
							});
							// debug("game", game.gameName, "completion percentage", lowest.globalCompletionPercentage);
						}
					}
					else
					{
						console.error("Game does not have lowestGlobalCompletionPercentage property", game.id);
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
		let result = [];

		let gameStore = this._games;
		_.each(this._user.data, function(userGame, id) {
			const game = gameStore.data[id];

			if (game)
			{
				if (game.achievements)
				{
					let hasStarted = userGame.playtime_forever !== 0 && !_.every(userGame.achievements, function(item) { return item.achieved === 0; });
					if (!userGame.ignore && (hasStarted || includeNotStarted))
					{
						_.each(game.achievements, function(achievement) {

							// find the achievement in the user data
							let userAchievement = _.findWhere(userGame.achievements, { apiname: achievement.name });

							if (achievement.globalCompletionPercentage && !(userAchievement && userAchievement.achieved))
							{
								result.push({
									id: id,
									gameName: game.gameName,
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
};
