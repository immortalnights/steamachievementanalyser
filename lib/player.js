const debug = require('debug')('player');
const Steam = require('./steam');
const fs = require('./filesystem');
const _ = require('underscore');

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

	/**
	 * Always resolves successfully; but data may not have been loaded
	 */
	load()
	{
		debug("attempting to load player profile", this.id);
		var self = this;
		return new Promise(function(resolve, reject) {
			fs.readFile(String(self.id) + '.json')
			.then(function(data) {
				debug("successfully loaded player profile");

				try
				{
					self._data = JSON.parse(data);
					resolve(self);
				}
				catch (err)
				{
					console.error("Failed to parse player data");
					reject(err);
				}
			})
			.catch(function(err) {
				console.warn("Failed to load profile for user", self.id, err);
				resolve(this);
			});
		});
	}

	save()
	{
		debug("saving user profile");

		return fs.writeFile(String(this.id) + '.json', JSON.stringify(this._data, null, 2))
		.then(function() {
			debug("saved user profile");
		});
	}

	refresh(privateKey)
	{
		const id = this.id;

		var steam = new Steam(privateKey);

		return steam.getOwnedGames(id)
		.then((games) => {
			// console.log("Games", games);
			return steam.getPlayerAchievementsForGames(id, games);
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
