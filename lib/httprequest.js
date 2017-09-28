const http = require('http');
const debug = require('debug')('http');
const query = require('querystring');
const _ = require('underscore');

const request = function(options, responseDataKey) {
	debug("HTTP", options);
	return new Promise(function(resolve, reject) {
		let responseData = '';
		let req = http.request(options, function(response) {

			response.on('data', function(chunk) {
				responseData += chunk;
			});

			response.on('end', function() {
				debug("Request completed");

				// TODO verify response is JSON
				const contentType = response.headers['content-type'] || '';
				if (contentType.startsWith('application/json'))
				{
					let responseJSON;
					try
					{
						debug("Parsing response data");
						responseJSON = JSON.parse(responseData);
						debug("Parsed response data");

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
					catch (e)
					{
						reject(e);
					}
				}
				else
				{
					reject("Invalid response\n" + responseData);
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
}

module.exports = class Requestor {
	constructor(host)
	{
		this.queue = [];
		this.processing = [];
		this.host = host;
	}

	request(path, data, responseDataKey)
	{
		let req = new Promise((resolve, reject) => {
			this._queue({
				method: 'GET',
				host: this.host,
				path: '/' + path + '?' + query.stringify(data),
				// data: query.stringify(data)
			}, responseDataKey, resolve, reject);
		});

		this._dequeue();

		return req;
	}

	_queue(options, responseDataKey, success, fail)
	{
		this.queue.push(function() {
			return request(options, responseDataKey).then(success, fail);
		});
		debug("request queued", this.queue.length);
	}

	_dequeue()
	{
		if (!_.isEmpty(this.queue) && this.processing.length < 1)
		{
			debug("dequeue", this.queue.length);

			let func = this.queue.pop();

			let promise = func();

			promise.then((value) => {
				this.processing.splice(this.processing.indexOf(promise), 20);
				this._dequeue();
				return value;
			}).catch((err) => function() {
				console.error("Queued request failed", err);
			});

			this.processing.push(promise);

			this._dequeue();
		}
	}
};
