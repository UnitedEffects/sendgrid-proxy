/**
 * Created by borzou on 9/28/16.
 */

const respond = require('../../helper');
const Promise = require('bluebird');
const auth = Promise.promisifyAll(require('./auth'));
const user = Promise.promisifyAll(require('../../user/controller/user'));

const authApi = {
    authorize: function(req, res){
        if (req.query.type !== 'code') return respond.sendJson(res, {err: 417, data: 'Unknown Access Type Requested'});
        if (!req.query.domain) return respond.sendJson(res, {err: 401, data: 'Your Domain is required'});
        if (!req.params.slug) return respond.sendJson(res, {err: 401, data: 'Your Product is required'});
        user.validateProductSlugAsync(req.user._id, req.params.slug)
            .then(function(result){
                if(!result) return respond.sendUnauthorized(res);
                return auth.requestGrantCodeAsync(req.user, req.query.domain)
            })
            .then(function (output) {
                if(output.data.user) {
                    output.data['username'] = output.data.user.username;
                    delete output.data.user;
                }
                return respond.sendJson(res, output);
            })
            .catch(function (error) {
                if (error.stack) console.log(error.stack);
                if(error.err===401) return respond.sendUnauthorized(res);
                return respond.sendJson(res, error);
            })
    },
    validate: function(req, res){
        if(!req.query.code) return respond.sendUnauthorized(res);
        user.validateProductSlugAsync(req.user._id, req.params.slug)
            .then(function(result){
                if(!result) return respond.sendUnauthorized(res);
                return auth.validateCodeAsync(req.user, req.query.code)
            })
            .then(function(output){
                authApi.cleanPassword(output, function(output){
                    return respond.sendJson(res, output);
                })
            })
            .catch(function(error){
                if(error.stack) console.log(error.stack);
                if(error.err===401) return respond.sendUnauthorized(res);
                return respond.sendJson(res, error);
            })
    },
    basicAuth: function(req, res){
        if(!req.user) return respond.sendUnauthorized(res);
        user.validateProductSlugAsync(req.user._id, req.params.slug)
            .then(function(result){
                if(!result) return respond.sendUnauthorized(res);
                return respond.sendJson(res, {err: null, data: req.user});
            })
            .catch(function(error){
                if(error.data.data) error = error.data;
                return respond.sendJson(res, error);
            });
    },
    bearerAuth: function(req, res){
        if(!req.user) return respond.sendUnauthorized(res);
        return respond.sendJson(res, {err: null, data: req.user});
    },
    cleanPassword: function(output, callback){
        const temp = JSON.parse(JSON.stringify(output));
        delete temp.data.user.password;
        callback(temp);
    },
    superAndProductAdminsOnly (req, res, next) {
        if(auth.validProductAdmin(req.user)) return next();
        return respond.sendUnauthorized(res);
    },
    superAndThisProductAdminsOnly (req, res, next) {
        let product = '';
        if(req.params.product_slug) product = req.params.product_slug;
        else if(req.params.slug) product = req.params.slug;
        else if(req.body.product_slug) product = req.body.product_slug;
        else if(req.body.slug) product = req.body.slug;
        else if(req.query.product_slug) product = req.query.product_slug;
        else if(req.query.slug) product = req.query.slug;
        if(auth.thisValidProductAdmin(req.user, product)) return next();
        return respond.sendUnauthorized(res);
    },
    superAdminOnly (req, res, next) {
        if(req.user.role === 1) return next();
        return respond.sendUnauthorized(res);
    },
    anyAdmin (req, res, next) {
        if(auth.validAdmin(req.user)) return next();
        return respond.sendUnauthorized(res);
    },
    superAndDomainAdminsOnly (req, res, next) {
        if(auth.validDomainAdmin(req.user)) return next();
        return respond.sendUnauthorized(res);
    },
    superAndThisDomainAdminsOnly (req, res, next) {
        let domain = '';
        if(req.params.domain_slug) domain = req.params.domain_slug;
        else if(req.params.slug) domain = req.params.slug;
        else if(req.body.domain_slug) domain = req.body.domain_slug;
        else if(req.body.slug) domain = req.body.slug;
        else if(req.query.domain_slug) domain = req.query.domain_slug;
        else if(req.query.slug) domain = req.query.slug;
        if(auth.thisValidDomainAdmin(req.user, domain)) return next();
        return respond.sendUnauthorized(res);
    },
    anyAdminOrOwner (req, res, next) {
        if(req.params.id === req.user._id ) return next();
        let domain = '';
        let product = '';
        if(req.params.domain_slug) domain = req.params.domain_slug;
        else if(req.params.slug) domain = req.params.slug;
        else if(req.body.domain_slug) domain = req.body.domain_slug;
        else if(req.body.slug) domain = req.body.slug;
        else if(req.query.domain_slug) domain = req.query.domain_slug;
        else if(req.query.slug) domain = req.query.slug;
        if(auth.thisValidDomainAdmin(req.user, domain)) return next();
        if(req.params.product_slug) product = req.params.product_slug;
        else if(req.params.slug) product = req.params.slug;
        else if(req.body.product_slug) product = req.body.product_slug;
        else if(req.body.slug) product = req.body.slug;
        else if(req.query.product_slug) product = req.query.product_slug;
        else if(req.query.slug) product = req.query.slug;
        if(auth.thisValidProductAdmin(req.user, product)) return next();
        return respond.sendUnauthorized(res);
    },
    isAuthenticated: auth.isAuthenticated,
    isBearerAuthenticated: auth.isBearerAuthenticated,
    isSocialAuthenticated: auth.isSocialAuthenticated,
    isChainedSocialBasic: auth.isChainedSocialBasic,
    isChainedSocialBearer: auth.isChainedSocialBearer,
    isAuthenticatedAny: auth.isAuthenticatedAny,
    isBasicOrCode: auth.isBasicOrCode,
    isAuthBasicOrBearer: auth.isAuthBasicOrBearer
};

module.exports = authApi;