const debug = require('debug')('datastore');
const Steam = require('./steam');
const fs = require('./filesystem');
const _ = require('underscore');

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

	fetch(privateKey, apps)
	{
		var steam = new Steam(privateKey);

		return steam.getSchemaForGames(_.map(apps, function(app) { return { appid: app }; }))
		.then((games) => {
			// console.log("Games", games);
			return steam.getGlobalAchievementPercentagesForGames(games);
		})
		.then((games) => {

			_.each(games, (game) => {
				const appId = game.appid;
				delete game.appid;

				this._data[appId] = game;
			});
		});
	}
}
