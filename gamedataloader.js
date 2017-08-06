const debug = require('debug')('dataloader');
const _ = require('underscore');
const util = require('util');
const filesystem = require('fs');
const http = require('./httprequest');

const fs = {
	writeFile: util.promisify(filesystem.writeFile)
};

// Set the base URL
http.baseURL = "api.steampowered.com";

// FIXME
var PRIVATE_API_KEY = '<undefined>';

const getGameId = function(game) {
	return gameId = game.gameName ? game.gameName + ' (' + game.appid + ')' : '(' + game.appid + ')';
}

const task_GetOwnedGames = function(userId) {
	debug("Get games owned for", userId);
	return http.request('IPlayerService/GetOwnedGames/v0001', {
		key: PRIVATE_API_KEY,
		steamid: userId,
		format: 'json'
	}, 'response').then(function(response) { return response.games; });
}

const task_GetSchemaForGames = function(games) {
	debug("Get schema for owned games", games.length);

	return new Promise(function(resolve, reject) {
		var check = _.after(games.length, function() {

			// Do not remove games which have no name
			if (false)
			{
				games = _.filter(games, function(game) {

					// debug
					if (!game.achievements)
					{
						debug("Game", getGameId(game), "has no achievements");
					}

					return !_.isEmpty(game.gameName);
				});
			}

			resolve(games);
		});

		// Some requests may fail if the game no longer exists
		var requests = _.map(games, function(game) {
			return task_GetSchemaForGame(game).then(check, check);
		});
	});
}

// Get game schema (name, achievements, etc)
const task_GetSchemaForGame = function(game) {
	debug("Get schema for game", game.appid);
	return http.request('ISteamUserStats/GetSchemaForGame/v2', {
		key: PRIVATE_API_KEY,
		appid: game.appid
	}, 'game').then(function(response) {

		// Extend the basic game data with the full schema, apply 'achievements' to the game object directly
		_.extend(game, _.omit(response, 'availableGameStats'));
		_.extend(game, response.availableGameStats);

		return game;
	}, function() {
		debug("Failed to get schema for game", game.appid);
	});
}

// Get global achievement completion statistics for a specific app
const task_GetGlobalAchievementPercentagesForGames = function(games) {
	debug("Get global achievements percentage for games", games.length);

	return new Promise(function(resolve, reject) {
		var check = _.after(games.length, function() {
			resolve(games);
		});

		// Some requests may fail if the game no longer exists or has no associated data
		var requests = _.map(games, function(game) {
			var result;

			if (!_.isEmpty(game.achievements))
			{
				result = task_GetGlobalAchievementPercentagesForGame(game).then(check, check);
			}
			else
			{
				check();
			}

			return result;
		});
	});
}

const task_GetGlobalAchievementPercentagesForGame = function(game) {
	debug("Get global achievement percentages for game", getGameId(game));

	return http.request('ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002', {
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

// Get player achievements for a specific game
const task_GetPlayerAchievementsForGames = function(games, userId) {
	debug("Get user achievements for games", games.length);

	return new Promise(function(resolve, reject) {
		var check = _.after(games.length, function() {
			resolve(games);
		});

		// Some requests may fail if the game no longer exists or has no associated data
		var requests = _.map(games, function(game) {
			var result;

			if (!_.isEmpty(game.achievements))
			{
				result = task_GetPlayerAchievementsForGame(game, userId).then(check, check);
			}
			else
			{
				check();
			}

			return result;
		});
	});
}

const task_GetPlayerAchievementsForGame = function(game, userId) {
	debug("Get user achievements for game", getGameId(game));

	return http.request('ISteamUserStats/GetPlayerAchievements/v0001', {
		key: PRIVATE_API_KEY,
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

		// Iterate game achievements and apply global states
		_.each(game.achievements, function(achievement) {
			// Find the achievement in the global states
			var playerAchievement = _.find(response.achievements, function(responseAchievement) {
				return responseAchievement.apiname === achievement.name;
			});

			if (playerAchievement)
			{
				_.extend(achievement, _.omit(playerAchievement, 'apiname'));
			}
			else
			{
				debug("Failed to find", achievement.name, "in global achievements");
			}
		});

		return game;
	}, function(e) {
		debug("Failed to get user achievements for game %s", getGameId(game));
		debug(e);
	});
}

module.exports = {
	retrieveAndCache: function(apiKey, userId) {
		return this.retrieve(apiKey, userId).then(function(data) {
			debug("Caching user profile");

			return fs.writeFile(String(userId) + '.json', JSON.stringify(data)).then(function() {
				debug("Cached user profile");
				return data;
			});
		});
	},

	retrieve: function(apiKey, userId) {
		// Bad practice, but needs some re-factoring to apply correctly
		PRIVATE_API_KEY = apiKey;

		return task_GetOwnedGames(userId)
			.then(task_GetSchemaForGames)
			.then(task_GetGlobalAchievementPercentagesForGames)
			.then(_.partial(task_GetPlayerAchievementsForGames, _, userId));
	}
};

// Test
// module.exports.retrieveAndCache('<userId>');
