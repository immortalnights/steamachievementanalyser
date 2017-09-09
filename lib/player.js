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
			var profileName = this.getProfileName();
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

	save()
	{
		debug("saving user profile");

		return fs.writeFile(this.getProfileName(), JSON.stringify(this._data, null, 2))
		.then(function() {
			debug("saved user profile");
		});
	}

	update(key)
	{
		var user = this;
		var steam = new Steam(key);

		console.log("Retrieving owned games...");
		return steam.getOwnedGames(user.id)
		.then(function(ownedGames) {
			// fetch all games which the user has, if they are new (and played), fetch the player achievements
			// Identify new games for statistical purposes
			// TODO fetch any games which are over 1 month old
			// TODO determine how long ago the data was refreshed and remember the game count change
			var newGames = _.filter(ownedGames, function(game) { return !_.has(user.data, game.appid); });
			console.log("Identified", newGames.length, "new games");

			// Add all new games to the user data
			_.each(newGames, function(game) {
				user.data[game.appid] = _.omit(game, 'appid');
			});

			var requiredGames = [];
			// The user may have played an old game, so look for any games with playtime but no achievement data
			_.each(user.data, function(game, key) {
				if (game.playtime_forever !== 0 && _.isUndefined(game.achievements))
				{
					requiredGames.push({
						appid: key
					});
				}
			});
	
			var promise;
			if (!_.isEmpty(requiredGames))
			{
				console.log("Get user achievements for %i game(s)...", requiredGames.length);

				var progress = new Progress('  retrieving [:bar] :percent :etas', {
					total: requiredGames.length,
					width: 25
				});

				promise = new Promise(function(resolve, reject) {
					var failures = 0;
					var check = _.after(requiredGames.length, function() {
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
					var requests = _.map(requiredGames, function(game) {
						return steam.getPlayerAchievementsForGame(user.id, game)
						.then(function(gameWithAchievements) {
							// Update the player game record
							console.assert(_.has(user.data, gameWithAchievements.appid));
							_.extend(user.data[gameWithAchievements.appid], _.omit(gameWithAchievements, 'appid'));

							// tick display progress
							progress.tick();

							// tick request progress
							check();
						})
						.catch(function(err) {
							if (_.isObject(err) && err.error === "Requested app has no stats")
							{
								// Set the achievements object on the game so stats are not requested again
								console.assert(_.has(user.data, game.appid));
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
			else
			{
				promise = Promise.resolve();
			}

			return promise
				.then(function(game) {
					console.log("Saving updated user data...");
					return user.save().catch(function(err) {
						console.error("Failed to save updated user data!", err)
					});
				})
				.catch(function(err) {
					console.error("Failed to retrieve any game achievement data");
					console.log(err);
				});
		});
	}
}
