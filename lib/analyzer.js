
module.exports = class Analyzer {
	constructor(user, games)
	{
		this._user = user;
		this._games = games;
	}

	// raw statistics
	get statistics()
	{
		return {
			totalGames: 0,
			playedGames: 0,
			unplayedGames: 0,
			mostPlayedGame: null,
			totalPlayTime: 0,
			totalAvailableAchievements: 0,
			totalAchievedAchievements: 0,
			recentAchievements: [],
			perfectGames: 0,
			completionPercentage: 0
		}
	}

	/**
	 * Owned games with the highest global completion percentage
	 */
	getEasiestGames()
	{
		var easiestGames = [];
		return easiestGames;
	}

	/**
	 * Outstanding achievements with highest global achievement percentage
	 */
	getEasiestAchievements(hasStarted)
	{
		var easiestAchievements = [];
		return easiestAchievements;
	}
}
