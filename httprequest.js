const http = require('http');
const debug = require('debug')('http');
const query = require('querystring');
const _ = require('underscore');

// Export the promise enabled request function only
module.exports = {
	baseURL: null,

	/**
	 *
	 * @param path URL path
	 * @param data or query string
	 * @param responseDataKey unwrap top level response objects
	 * @return {Promise}
	 */
	request: function(path, data, responseDataKey) {
		debug("HTTP ", path);
		var options = {
			host: this.baseURL,
			path: '/' + path + '?' + query.stringify(data),
			data: query.stringify(data)
		};

		return new Promise(function(resolve, reject) {
			var responseData = '';
			var req = http.request(options, function(response) {

				response.on('data', function(chunk) {
					responseData += chunk;
				});

				response.on('end', function() {
					debug("Request completed");

					// TODO verify response is JSON
					var responseJSON;

					try
					{
						debug("Parsing response data");
						responseJSON = JSON.parse(responseData);
						debug("Parsed response data");
					}
					catch (e)
					{
						debug("Parse Error!", e);
						debug(responseData);
					}

					if (responseJSON)
					{
						if (responseJSON[responseDataKey])
						{
							if ((this.statusCode >= 200 && this.statusCode < 300) || this.statusCode === 301)
							{
								debug("Completed successfully");
								resolve(responseJSON[responseDataKey]);
							}
							else
							{
								debug("Completed with error; error response");
								reject(responseJSON[responseDataKey]);
							}
						}
						else
						{
							debug("Completed with error; invalid responseDataKey", _.keys(responseJSON));
							reject({ error: "Response does not contain object '" + responseDataKey + "'" });
						}
					}
					else
					{
						debug("Completed with error; invalid response data");
						reject({ error: "Invalid or none JSON response" });
					}
				});

				response.on('abort', function() {
					debug("Request aborted");
					reject("Aborted");
				});
			});

			req.on('error', function(response) {
				reject(response);
			});

			req.end();
		});

		return rp;
	},

	// Handle multiple requests. Promise resolves unless all requests fail.
	requestAll: function(requests) {
		var promise = new Promise();
		var outstanding = requests.length;

		var succeeded = [];
		var failed = [];

		var checkComplete = function() {
			--outstanding;
			if (0 === outstanding)
			{
				if (!_.isEmpty(succeeded))
				{
					promise.resolve(succeeded, failed);
				}
				else
				{
					promise.reject(succeeded, failed);
				}
			}
		}

		_.each(requests, function(req) {
			req
			.done(function() {
				succeeded.push(req);
				checkComplete();
			})
			.fail(function() {
				failed.push(req);
				checkComplete();
			});
		});

		return promise;
	}
};
