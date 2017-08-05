const loader = require('./gamedataloader');
const analyzer = require('./analyzer');

var args = process.argv.splice(2);

if (args.length < 2 || args.length > 3)
{
	console.error("Usage [task] <Steam API Key> <User Id>");
}
else
{
	if (args.length === 2)
	{
		args.unshift('retrieveAndAnalyze');
	}

	const task = args[0];
	const apiKey = args[1];
	const userId = args[2];

	switch (task)
	{
		case 'retrieveAndAnalyze':
		{
			console.log("Retrieving user game data");
			loader.retrieveAndCache(apiKey, userId)
			.then(function(data) {
				console.log("Analyzing game data");
				analyzer.analyze(data)
				.then(function() {
					console.log("Completed");
				});
			})
			.catch(console.error);
			break;
		}
		case 'retrieve':
		{
			console.log("Retrieving user game data");
			loader.retrieveAndCache(apiKey, userId)
			.then(function() {
				console.log("Completed");
			})
			.catch(console.error);
			break;
		}
		case 'analyze':
		{
			console.log("Analyzing cached game data");
			analyzer.analyzeFromCache(userId)
			.then(function() {
				console.log("Completed");
			})
			.catch(console.error);
			break;
		}
		default:
		{
			console.error("Invalid task available 'retrieveAndAnalyze', 'retrieve', 'analyze'");
			break;
		}
	}
}
