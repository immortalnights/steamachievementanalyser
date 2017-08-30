const debug = require('debug')('player');
const Steam = require('./steam');
const fs = require('./filesystem');
const _ = require('underscore');

module.exports = class Player {
	constructor(userId)
	{
		this.userId = userId;
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
		debug("attempting to load player profile", this.userId);
		var self = this;
		return new Promise(function(resolve, reject) {
			fs.readFile(String(self.userId) + '.json')
			.then(function(data) {
				debug("successfully loaded player profile");

				self._data = JSON.parse(data);
				resolve();
			})
			.catch(function(err) {
				debug("failed to load user profile", err);
				resolve();
			});
		});
	}

	save()
	{
		debug("saving user profile");

		return fs.writeFile(String(this.userId) + '.json', JSON.stringify(this._data, null, 2))
		.then(function() {
			debug("saved user profile");
		});
	}

	refresh(privateKey)
	{
		const userId = this.userId;

		var steam = new Steam(privateKey);

		return steam.getOwnedGames(userId)
		.then((games) => {
			// console.log("Games", games);
			return steam.getPlayerAchievementsForGames(userId, games);
		})
		.then((games) => {
			_.each(games, (game) => {
				const appId = game.appid;
				delete game.appid;

				this._data[appId] = game;
			});

			return this._data;
		});
	}
}
