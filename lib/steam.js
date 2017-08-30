const debug = require('debug')('steam');
const Requestor = require('../httprequest');
const _ = require('underscore');

module.exports = class Steam {
	constructor(privateKey)
	{
		this.requestor = new Requestor("api.steampowered.com");
		this.privateKey = privateKey;
	}

	getOwnedGames(userId)
	{
		debug("Get games owned for", userId);
		return this.requestor.request('IPlayerService/GetOwnedGames/v0001/', {
			key: this.privateKey,
			steamid: userId,
			format: 'json'
		}, 'response').then(function(response) { return response.games; });
	}

	// Get player achievements for a specific game
	getPlayerAchievementsForGames(userId, games)
	{
		debug("Get user (%s) achievements for %i games", userId, games.length);

		var self = this;
		return new Promise(function(resolve, reject) {
			var check = _.after(games.length, function() {
				resolve(games);
			});

			// Some requests may fail if the game no longer exists or has no associated data
			var requests = _.map(games, function(game) {
				return self.getPlayerAchievementsForGame(userId, game).then(check, check);
			});
		});
	}

	getPlayerAchievementsForGame(userId, game)
	{
		debug("Get user achievements for game", game.appid);

		return this.requestor.request('ISteamUserStats/GetPlayerAchievements/v0001', {
			key: this.privateKey,
			steamid: userId,
			appid: game.appid,
		}, 'playerstats').then(function(response) {

			// Sometimes the game schema doesn't include the game name and this endpoint does.
			if (!game.gameName || game.gameName.startsWith('ValveTestApp'))
			{
				if (response.gameName)
				{
					game.gameName = response.gameName;
				}
			}

			game.achievements = response.achievements;

			return game;
		}, function(e) {
			debug("Failed to get user achievements for game %s", game.appid);
			debug(e);
		});
	}

	getSchemaForGames(games)
	{
		debug("Get schema for owned games", games.length);

		var self = this;
		return new Promise(function(resolve, reject) {
			var check = _.after(games.length, function() {

				var result = _.filter(games, function(game) {

					// debug
					if (!game.achievements)
					{
						debug("Game", getGameId(game), "has no achievements");
					}

					return !_.isEmpty(game.gameName);
				});

				resolve(result);
			});

			// Some requests may fail if the game no longer exists
			var requests = _.map(games, function(game) {
				return self.getSchemaForGame(game).then(check, check);
			});
		});
	}

	// Get game schema (name, achievements, etc)
	getSchemaForGame(game)
	{
		debug("Get schema for game", game.appid);
		return this.requestor.request('ISteamUserStats/GetSchemaForGame/v2', {
			key: this.privateKey,
			appid: game.appid
		}, 'game').then(function(response) {

			// Extend the basic game data with the full schema, apply 'achievements' to the game object directly
			_.extend(game, _.omit(response, 'availableGameStats'));
			_.extend(game, response.availableGameStats);

			return game;
		}, function(err) {
			debug("Failed to get schema for game", game.appid, err);
		});
	}

	// Get global achievement completion statistics for a specific app
	getGlobalAchievementPercentagesForGames(games)
	{
		debug("Get global achievements percentage for games", games.length);

		var self = this;
		return new Promise(function(resolve, reject) {
			var check = _.after(games.length, function() {
				resolve(games);
			});

			// Some requests may fail if the game no longer exists or has no associated data
			var requests = _.map(games, function(game) {
				var result;

				if (!_.isEmpty(game.achievements))
				{
					result = self.getGlobalAchievementPercentagesForGame(game).then(check, check);
				}
				else
				{
					check();
				}

				return result;
			});
		});
	}

	getGlobalAchievementPercentagesForGame(game)
	{
		debug("Get global achievement percentages for game", game.appid);

		return this.requestor.request('ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002', {
			gameid: game.appid
		}, 'achievementpercentages').then(function(response) {
			// Iterate game achievements and apply global states
			_.each(game.achievements, function(achievement) {
				// Find the achievement in the global states
				var globalAchievement = _.find(response.achievements, function(responseAchievement) {
					return responseAchievement.name === achievement.name;
				});

				if (globalAchievement)
				{
					achievement.globalCompletionPercentage = globalAchievement.percent;
				}
				else
				{
					debug("Failed to find '%s' in global achievements for game %s", achievement.name, getGameId(game.gameName));
				}
			});

			return game;
		}, function() {
			debug("Failed to get global achievement percentages for game %s", getGameId(game.gameName));
		});
	}
};
