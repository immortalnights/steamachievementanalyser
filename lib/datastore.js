const debug = require('debug')('datastore');
const Steam = require('./steam');
const fs = require('./filesystem');
const _ = require('underscore');
const Progress = require('progress');

module.exports = class GameDatabase {
	constructor(file)
	{
		this.fileName = file;
		this._data = {};
	}

	get data()
	{
		return this._data;
	}

	/**
	 * Always resolves successfully; but data may not have been loaded
	 */
	load()
	{
		debug("attempting to load data store", this.fileName);
		return new Promise((resolve, reject) => {
			if (fs.exists(this.fileName))
			{
				fs.readFile(this.fileName)
				.then((data) => {
					debug("successfully loaded data store");

					try
					{
						this._data = JSON.parse(data);
						resolve(this);
					}
					catch (err)
					{
						debug("Failed to parse data store data");
						reject(err);
					}
				})
				.catch(function(err) {
					debug("failed to load data store", err);
					resolve(this);
				});
			}
			else
			{
				console.log("store doesn't exist");
				resolve(this);
			}
		});
	}

	save()
	{
		debug("saving game data");

		return fs.writeFile(this.fileName, JSON.stringify(this._data, null, 2))
		.then(function() {
			debug("saved game data");
		});
	}

	getSchemaForGames(key, requiredGames)
	{
		let store = this;
		let steam = new Steam(key);
		let promise;

		if (!_.isEmpty(requiredGames))
		{
			let progress = new Progress('  retrieving [:bar] :percent :etas', {
				total: requiredGames.length,
				width: 25
			});

			console.log("Retrieve schema for %i games", requiredGames.length);
			promise = new Promise(function(resolve, reject) {
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
					return steam.getSchemaForGame(game)
					.then(function(gameWithSchema) {
						if (gameWithSchema && gameWithSchema.appid)
						{
							// Update the game record
							_.extend(store.data[gameWithSchema.appid], _.omit(gameWithSchema, 'appid', 'gameName'));
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
							console.assert(_.has(user.data, game.appid));
							user.data[game.appid].achievements = false;
						}
						else
						{
							console.log("Failed to get schema for", game.appid);
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

		return promise;
	}

	getGlobalAchievementsForGames(key, requiredGames)
	{
		let store = this;
		let steam = new Steam(key);
		let promise;

		if (!_.isEmpty(requiredGames))
		{
			let progress = new Progress('  retrieving [:bar] :percent :etas', {
				total: requiredGames.length,
				width: 25
			});

			console.log("Retrieve global achievements for %i games", requiredGames.length);
			promise = new Promise(function(resolve, reject) {
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
					return steam.getGlobalAchievementPercentagesForGame(game)
					.then(function(gameWithAchievements) {

						if (gameWithAchievements && gameWithAchievements.appid)
						{
							let storeGame = store.data[gameWithAchievements.appid];

							// Update the game record
							_.extend(storeGame, _.omit(gameWithAchievements, 'appid', 'gameName'));

							// apply to the game the lowest globalCompletionPercentage
							if (!_.isEmpty(storeGame.achievements))
							{
								let lowest = _.min(storeGame.achievements, function(achievement) { return achievement.globalCompletionPercentage; });
								storeGame.lowestGlobalCompletionPercentage = lowest.globalCompletionPercentage;
							}
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
							console.assert(_.has(store.data, game.appid));
							store.data[game.appid].achievements = false;
						}
						else
						{
							console.log("Failed to get global achievements for", game.appid);
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

		return promise;
	}
};
