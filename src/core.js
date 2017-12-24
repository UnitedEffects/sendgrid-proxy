const proxy = require('express-http-proxy');
const server = require('express')();
const wordingArray = require('../wording.json');

let spinner;

/**
 * run
 *
 * @since 1.0.0
 *
 * @param runArray array
 */

function run(runArray)
{
	server.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, HEAD, POST, DELETE, PUT, PATCH, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, api_key, Authorization");
        next();
    });

	server.use('/ue', (req, res) => {
		res.status(200).send('running');
	});

	server.use('/', proxy('api.sendgrid.com',
	{
		https: true,
		proxyReqOptDecorator: proxyReqOpts =>
		{
			proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.SENDGRID_API_ID;
			proxyReqOpts.headers['Content-Type'] = 'application/json';
			return proxyReqOpts;
		},
		userResDecorator: (proxyRes, proxyResData, userReq, userRes) =>
		{
			userRes.set('Access-Control-Allow-Origin', '*');
			if (userRes.statusCode > 399 && userRes.statusCode < 600)
			{
				spinner.fail(userReq.method + ' ' + userReq.path + ' ' + userRes.statusCode);
			}
			else
			{
				spinner.pass(userReq.method + ' ' + userReq.path + ' ' + userRes.statusCode);
			}
			return proxyResData;
		}
	}));

	/* listen */

	server.listen(runArray.port, () =>
	{
		spinner.start(wordingArray.listen_on + ' ' + wordingArray.colon + runArray.port);
	});
}

/**
 * construct
 *
 * @since 1.0.0
 *
 * @param dependency object
 *
 * @return object
 */

function construct(dependency)
{
	const exports =
	{
		run: run
	};

	/* inject dependency */

	if (dependency.spinner)
	{
		spinner = dependency.spinner;
	}
	return exports;
}

module.exports = construct;
