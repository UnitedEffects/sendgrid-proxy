/**
 * Created by borzou on 9/27/16.
 */
const passport = require('passport');
const Promise = require('bluebird');
const BasicStrategy = require('passport-http').BasicStrategy;
const BearerStrategy = require('passport-http-bearer').Strategy;
const User = Promise.promisifyAll(require('../../user/model/user'));
const Perm = Promise.promisifyAll(require('../../user/model/admin'));
const Role = Promise.promisifyAll(require('../../user/model/roles'));
const Code = Promise.promisifyAll(require('../model/auth'));
const Token = Promise.promisifyAll(require('../model/token'));
const moment = require('moment');
const request = Promise.promisify(require('request'));
const send = require('../../callback');
const config = require('../../../config');
const helper = require('../../helper');


passport.use('basic', new BasicStrategy({
        passReqToCallback: true
    },
    function(req, username, password, callback) {
        User.findOneAsync({username: username, active:true})
            .then(function(user){
                if(!user) return callback(null, false);
                if(!user.active) return callback(null, false);
                user.verifyPassword(password, function(err, isMatch) {
                    if (err) return callback(null, false);

                    // Password did not match
                    if (!isMatch) return callback(null, false);

                    // Success
                    if(req.params.slug){
                        const modUser = JSON.parse(JSON.stringify(user));
                        modUser['activity'] = {
                            product: req.params.slug
                        };
                        Role.find({user_id: modUser._id, product_slug: req.params.slug})
                            .then(function(results){
                                return results;
                            })
                            .each(function(role){
                                modUser['permissions']={
                                    product: {}
                                };
                                modUser.permissions.product[req.params.slug]={};
                                modUser.permissions.product[req.params.slug][role.role]=true;
                            })
                            .then(function(){
                                //console.log(JSON.stringify(user, null, 2));
                                return callback(null, modUser);
                            })
                    }
                    else return callback(null, user);
                });
            })
            .catch(function(err){
                err["detail"] = 'Basic Auth Failure';
                return callback(err, false);
            });
    }
));

passport.use('access', new BasicStrategy(
    function(username, password, callback) {
        let count = 1;
        Code.find({"user.username": username})
            .then(function(result){
                if(result.length===0) return callback(null, false);
                const total = result.length;
                Promise.map(result, function(access){
                    return access.verifyCode(password, function(err, isMatch){
                        if(isMatch) {
                            return callback(null, access.user);
                        }
                        if(count>=total) return callback(null, false);
                        count++;
                    })
                });
            })
            .catch(function(err){
                err["detail"] = 'Access Auth Failure';
                return callback(err, false);
            });
    }
));

passport.use('social', new BearerStrategy(
    function(accessToken, callback){
        try {
            if (!accessToken) return callback(null, false);
            var lookup = accessToken.split('.');
            if (!lookup.length >= 2) return callback(null, false);
            var userId = (lookup[0]) ? Buffer.from(lookup[0], 'base64').toString('ascii') : null;
            var tokenVal = (lookup[1]) ? Buffer.from(lookup[1], 'base64').toString('ascii') : null;
            if (!userId) return callback(null, false);
            if (!tokenVal) return callback(null, false);
            Token.findOneAsync({user_id: userId})
                .then(function (token) {
                    if (!token) return callback(null, false);
                    token.verifyToken(tokenVal, function (err, isMatch) {
                        if (err) return callback(err, false);
                        if (!isMatch) return callback(null, false);

                        token.user["token"] = accessToken;
                        token.user["expires"] = moment(token.created).add(12, 'hours');
                        token.user["token_created"] = token.created;
                        return callback(null, token.user);
                    })
                })
                .catch(function (error) {
                    return callback(null, false);
                })
        }catch(error){
            return callback(null, false);
        }
    }
));

passport.use('bearer', new BearerStrategy(
    function(accessToken, callback) {
        try {
            if (!accessToken) return callback(null, false);
            var fullToken = Buffer.from(accessToken.replace(/%3D/g, '='), 'base64').toString('ascii');
            var lookup = fullToken.split('.');
            if (!lookup.length >= 2) return callback(null, false);
            var userId = (lookup[0]) ? lookup[0] : null;
            var tokenVal = (lookup[1]) ? lookup[1] : null;
            var product =  (lookup[2]) ? lookup[2] : null;
            var domain = (lookup[3]) ? lookup[3] : null;

            if(!product) return callback(null, false);
            if(!domain) return callback(null, false);
            Token.findOneAsync({user_id: userId, product_slug: product, domain_slug: domain})
                .then(function (token) {
                    if (!token) {
                        getBearerToken(accessToken, function(err, result){
                            return callback(err, result);
                        })
                    } else {
                        token.verifyToken(tokenVal, function (err, isMatch) {
                            if (err) return callback(null, false);
                            if (isMatch) {
                                token.user["token"] = accessToken;
                                token.user["expires"] = moment(token.created).add(12, 'hours');
                                token.user["token_created"] = token.created;
                                return callback(null, token.user);
                            } else {
                                //getting token
                                getBearerToken(accessToken, function(err, result){
                                    return callback(err, result);
                                })
                            }

                        })
                    }
                })
                .catch(function (error) {
                    error["detail"]='Bearer Auth from Domain Service';
                    return callback(error, false);
                });
        }catch(error){
            error["detail"]='Unhandled Error caught at Bearer Auth from Domain Service';
            return callback(error, false);
        }
    }
));

function getBearerToken(accessToken, callback){
    var fullToken = Buffer.from(accessToken.replace(/%3D/g, '='), 'base64').toString('ascii');
    var lookup = fullToken.split('.');
    var reqOptions = {
        method: 'GET',
        uri: config.authApiServer + '/api/validate',
        auth: {
            bearer: accessToken
        }
    };
    request(reqOptions)
        .then(function (response) {
            if (response.statusCode !== 200) return callback(null, false);
            var returned = (helper.isJson(response.body)) ? JSON.parse(response.body) : response.body;
            try {
                authFactory.saveToken(returned.data, {product: lookup[2] || null, domain: lookup[3] || null}, lookup[1], function (err, saved) {
                    //if (err) console.log('validated token but could not save - moving on.');
                    return callback(null, returned.data);
                });
            } catch (err) {
                //console.log(err);
                return callback(null, false);
            }
        })
        .catch(function (error) {
            error["detail"] = 'Bearer Auth from Domain Service';
            return callback(error, false);
        });
}

passport.serializeUser(function(user, done) {
    done(null, user._id);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

function newGrantCode(user, domain, callback){

    var dateNow = Date.now();

    var rawCode = {
        code: uid(64),
        user_id: user._id,
        user: user,
        domain: domain,
        created: moment(dateNow),
        expires: moment(dateNow).add(10, 'minutes')
    };

    var code = new Code({
        code: rawCode.code,
        user_id: user._id,
        user: user,
        domain: domain,
        created: moment(dateNow),
        expires: moment(dateNow).add(10, 'minutes')
    });

    code.saveAsync()
        .then(function(saved){
            callback(null, rawCode);
        })
        .catch(function(error){
            callback(error, rawCode);
        });
};

function uid (len) {
    var buf = []
        , chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.'
        , charlen = chars.length;

    for (var i = 0; i < len; ++i) {
        buf.push(chars[getRandomInt(0, charlen - 1)]);
    }

    return buf.join('');
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function checkCodes (codes, code, cb){
    var total = codes.length;
    var count = 1;
    codes.forEach(function(cd){
        cd.verifyCode(code, function(err, isMatch) {
            if (err) return cb(err, false);
            if (isMatch) return cb(null, true);
            if (count >= total) cb(null, false);
            count++;
        });
    })
}

var authFactory = {
    requestGrantCode: function(user, domain, cb){
        newGrantCode(user, domain, function(err, rawCode){
            if (err) return cb(send.fail403(),null);
            var connect = {
                method: 'POST',
                uri: config.authApiServer + '/api/useraccess?code='+config.webhook,
                json: rawCode
            };
            request(connect)
                .then(function(result){
                    if(result.statusCode===200) return cb(null, send.success(rawCode));
                    return cb(send.fail(result.statusCode, {detail: "This is from domain service", info: result.body}), null);
                })
                .catch(function(error){
                    return cb(send.failErr(error), null);
                })
        })
    },
    validateCode: function(user, code, callback){
        Code.findAsync({user_id: user._id})
            .then(function(codes){
                if (codes.length===0) return callback(send.fail401(), false);
                var checking = Promise.promisify(checkCodes);
                checking(codes, code)
                    .then(function(result){
                        if(result) {
                            return callback(null,send.success({code:code, user: user}));
                        }
                        else return callback(send.fail401(), false);
                    })
                    .catch(function(error){
                        return callback(send.failErr(error),null);
                    });
            })
            .catch(function(err){
                return callback(err, null);
            });
    },
    saveToken: function (user, access, tokenVal, callback){
        Token.findOneAndRemoveAsync({user_id: user._id, product_slug: access.product, domain_slug: access.domain})
            .then(function(result){
                var tCreated = user.token_created;

                var temp = JSON.parse(JSON.stringify(user));
                delete temp.token;
                delete temp.token_created;
                delete temp.expires;

                var token = new Token({
                    value: tokenVal,
                    user_id: user._id,
                    product_slug: access.product,
                    domain_slug: access.domain,
                    user: temp,
                    created: tCreated
                });

                token.saveAsync()
                    .then(function (saved) {
                        callback(null, saved);
                    })
                    .catch(function (error) {
                        callback(error, null);
                    });
            })
            .catch(function(error){
                callback(error, null);
            })

    },
    canAddAdmin: function(cb){
        Perm.findAsync({})
            .then(function(result){
                if(result.length > config.numberOfAdmins) return cb(null, false);
                return cb(null, true);
            })
            .catch(function(error){
                return cb(error, false);
            })
    },
    upgradeToken: function(user, cb){
        Token.findOneAndUpdateAsync({user_id:user._id}, {user:user}, {new: true})
            .then(function(result){
                return cb(null, result);
            })
            .catch(function(error){
                return cb(error, null);
            })
    },
    returnUid: function(bits){
        return uid(bits);
    },
    isBearerAuthenticated: passport.authenticate('bearer', { session: false }),
    isAuthenticated: passport.authenticate('basic', { session : false}),
    isBasicOrCode: passport.authenticate(['basic','access'], {session : false}),
    isSocialAuthenticated: passport.authenticate('social', {session: false}),
    isChainedSocialBasic: passport.authenticate(['social','basic'], {session: false}),
    isChainedSocialBearer: passport.authenticate(['social','bearer'], {session: false}),
    isAuthenticatedAny: passport.authenticate(['basic', 'bearer', 'social'], {session: false}),
    isAuthBasicOrBearer: passport.authenticate(['basic', 'bearer'], {session: false}),
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