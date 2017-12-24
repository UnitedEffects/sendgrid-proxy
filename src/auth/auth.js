/**
 * Created by borzou on 9/27/16.
 */
const passport = require('passport');
const BearerStrategy = require('passport-http-bearer').Strategy;
const PromiseB = require('bluebird');
const request = PromiseB.promisify(require('request'));
const config = require('../config');
const helper = require('../helper');

passport.use('bearer', new BearerStrategy(
    function(accessToken, callback) {
        try {
            if (!accessToken) return callback(null, false);
            const fullToken = Buffer.from(accessToken.replace(/%3D/g, '='), 'base64').toString('ascii');
            const lookup = fullToken.split('.');
            if (!lookup.length >= 2) return callback(null, false);
            const product =  (lookup[2]) ? lookup[2] : null;
            const domain = (lookup[3]) ? lookup[3] : null;

            if(!product) return callback(null, false);
            if(!domain) return callback(null, false);

            getBearerToken(accessToken, function(err, result){
                return callback(err, result);
            })
        }catch(error){
            error["detail"]='Unhandled Error caught at Bearer Auth from Domain Service';
            return callback(error, false);
        }
    }
));

function getBearerToken(accessToken, callback){
    const reqOptions = {
        method: 'GET',
        uri: config.authApiServer + '/api/validate',
        auth: {
            bearer: accessToken
        }
    };
    request(reqOptions)
        .then(function (response) {
            if (response.statusCode !== 200) return callback(null, false);
            const returned = (helper.isJson(response.body)) ? JSON.parse(response.body) : response.body;
            if(returned.data) return callback(null, returned.data);
            return callback(null, false);
        })
        .catch(function (error) {
            error["detail"] = 'Bearer Auth validation error from domain service.';
            return callback(error, false);
        });
}

passport.serializeUser(function(user, done) {
    done(null, user._id);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

const authFactory = {
    isBearerAuthenticated: passport.authenticate('bearer', { session: false }),
    validProductAdmin (user) {
        if(user.role === 1) return true;
        else if(user.activity) if (user.activity.product) if(user.permissions) if(user.permissions.product) if(user.permissions.product[user.activity.product]) {
            return user.permissions.product[user.activity.product].admin;
        }
        return false;
    },
    validDomainAdmin (user) {
        if(user.role === 1) return true;
        else if(user.activity) if (user.activity.domain) if(user.permissions) if(user.permissions.domain) if(user.permissions.domain[user.activity.domain]) {
            return user.permissions.domain[user.activity.domain].admin;
        }
        return false;
    },
    validAdmin (user) {
        if(user.role === 1) return true;
        else if(this.validProductAdmin(user)) return true;
        else if(this.validDomainAdmin(user)) return true;
        return false;
    },
    thisValidProductAdmin (user, product) {
        if(user.role === 1) return true;
        else if(user.permissions) if(user.permissions.product) if(user.permissions.product[product]) {
            return user.permissions.product[product].admin;
        }
        return false;
    },
    thisValidDomainAdmin (user, domain) {
        if(user.role === 1) return true;
        else if(user.permissions) if(user.permissions.domain) if(user.permissions.domain[domain]) {
            return user.permissions.domain[domain].admin;
        }
        return false;
    }
};

module.exports = authFactory;