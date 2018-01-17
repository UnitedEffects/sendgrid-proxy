/**
 * Created by borzou on 4/1/17.
 */

const config = {
    authApiServer: (process.env.NODE_ENV==='production') ? 'https://domain.unitedeffects.com' : 'https://domainqa.unitedeffects.com',
    emailHook: process.env.SENDGRID_API_ID || 'SENDGRIDAPIID'
};

module.exports = config;