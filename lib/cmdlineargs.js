const cmdLineArgs = require('command-line-args');
const cmdLineUsage = require('command-line-usage');

module.exports = function(appName, appDescription, options) {
	return {
		parse: function() {
			return cmdLineArgs(options)
		},

		usage: function() {
			return cmdLineUsage([{
				header: appName,
				content: appDescription
			},
			{
				header: 'Options',
				optionList: options
			}]);
		}
	};
};
