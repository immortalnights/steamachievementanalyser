const debug = require('debug')('player');
const Steam = require('./steam');
const fs = require('./filesystem');
const _ = require('underscore');
const Progress = require('progress');

module.exports = class Player {
	constructor(id)
	{
		this.id = id;
		this._data = {};
	}

	get data()
	{
		return this._data;
	}

	getProfileName()
	{
		return 'user-' + String(this.id) + '.json';
	}

	/**
	 * Always resolves successfully; but data may not have been loaded
	 */
	load()
	{
		debug("attempting to load player profile", this.id);
		return new Promise((resolve, reject) => {
			let profileName = this.getProfileName();
			if (fs.exists(profileName))
			{
				fs.readFile(profileName)
				.then((data) => {
					debug("successfully loaded player profile");

					try
					{
						this._data = JSON.parse(data);
						resolve(this);
					}
					catch (err)
					{
						console.error("Failed to parse player data");
						reject(err);
					}
				})
				.catch((err) => {
					console.warn("Failed to load profile for user", this.id, err);
					resolve(this);
				});
			}
			else
			{
				console.log("profile doesn't exist for user");
				resolve(this);
			}
		});
	}

	update(key)
	{
		return this._refreshOwnedGames(key)
		.then((requiredGames) => {
			let promise;
			if (!_.isEmpty(requiredGames))
			{
				promise = this._refreshGameAchievements(key, requiredGames);
			}

			return promise;
		})
		.then(() => {
			this._data.lastUpdated = _.now();

			return this.save().catch(function(err) {
				console.error("Failed to save user data!", err)
			})
		})
		.catch(function(err) {
			console.error("Failed to retrieve any game achievement data");
			console.log(err);
		});
	}

	save()
	{
		debug("saving user profile");

		return fs.writeFile(this.getProfileName(), JSON.stringify(this._data, null, 2))
		.then(function() {
			debug("saved user profile");
		});
	}

	_refreshOwnedGames(key)
	{
		const user = this;
		const steam = new Steam(key);

		return steam.getOwnedGames(this.id)
		.then(function(ownedGames) {
			console.log("Player owns", ownedGames.length, "games");

			let requiredGames = [];
			let newGames = 0;
			let playedGames = 0;

			_.each(ownedGames, function(game) {
				let userGame = user.data[game.appid];

				let gameData;

				// Always get achievements for new games
				if (!userGame)
				{
					++newGames;

					// Add game to user data
					gameData = {
						added: _.now()
					};

					requiredGames.push(_.pick(game, 'appid'));
				}
				else
				{
					gameData = user.data[game.appid];

					// One time update of legacy data
					if (!_.isArray(gameData.playtime_2weeks))
					{
						delete gameData.playtime_2weeks;
					}

					if (!gameData.added)
					{
						gameData.added = _.now();
					}

					// Only update the game achievements if it's been played since the last update
					if (game.playtime_forever !== 0 && game.playtime_forever !== userGame.playtime_forever
				         && userGame.achievements !== false
				         && userGame.completed !== true)
					{
						++playedGames;
						requiredGames.push(_.pick(game, 'appid'));
					}
				}

				// Update/set game data - recent playtime is handled separately
				_.extend(gameData, _.omit(game, 'appid', 'playtime_2weeks'));

				let lastPlaytime2Weeks;
				if (!_.isEmpty(gameData.playtime_2weeks))
				{
					lastPlaytime2Weeks = _.last(gameData.playtime_2weeks);
				}

				if (game.playtime_2weeks !== lastPlaytime2Weeks)
				{
					if (!gameData.playtime_2weeks)
					{
						gameData.playtime_2weeks = [];
					}

					gameData.playtime_2weeks.push({
						value: game.playtime_2weeks || 0,
						when: _.now()
					});
				}

				user.data[game.appid] = gameData;
			});

			console.log("Identified %i new game(s) and %i played game(s) since last update", newGames, playedGames);

			return requiredGames;
		})
		.catch(function(err) {
			console.error("Failed to refresh owned games", err);
		});
	}

	_refreshGameAchievements(key, requiredGames)
	{
		const user = this;
		const steam = new Steam(key);

		console.log("Get user achievements for %i game(s)...", requiredGames.length);
		let progress = new Progress('  retrieving [:bar] :percent :etas', {
			total: requiredGames.length,
			width: 25
		});

		return new Promise(function(resolve, reject) {
			let failures = 0;
			let check = _.after(requiredGames.length, function() {
				// complete the progress
				progress.tick();

				// have to print a newline to break from the progress output
				console.log("");

				// reject parent promise if all requests failed
				if (requiredGames.length === failures)
				{
					console.log("All requests failed");
					reject();
				}
				else
				{
					resolve(requiredGames);
				}
			});

			// Some requests may fail if the game no longer exists or has no associated data
			// if the game does not have achievements it should be marked so that it's not requested again
			let requests = _.map(requiredGames, function(game) {
				return steam.getPlayerAchievementsForGame(user.id, game)
				.then(function(gameWithAchievements) {
					// Update the player game record
					console.assert(_.has(user.data, gameWithAchievements.appid), "user data does not have game", gameWithAchievements.appid);
					_.extend(user.data[gameWithAchievements.appid], _.omit(gameWithAchievements, 'appid'));

					let userGame = user.data[gameWithAchievements.appid];
					// Set the completed flag if all achievements have been achieved
					if (_.every(userGame.achievements, 'achieved'))
					{
						userGame.completed = true;
					}

					// tick display progress
					progress.tick();

					// tick request progress
					check();
				})
				.catch(function(err) {
					if (_.isObject(err) && err.error === "Requested app has no stats")
					{
						// Set the achievements object on the game so stats are not requested again
						console.assert(_.has(user.data, game.appid), "user data does not have game", game.appid);
						user.data[game.appid].achievements = false;
					}
					else
					{
						console.log("Failed to get achievements for", game.appid);
						console.log(err);
						++failures;
					}

					progress.tick();
					check();
				});
			});
		});
	}
};
