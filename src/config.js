/**
 * Created by borzou on 4/1/17.
 */

const config = {
    authApiServer: process.env.DOMAIN || 'https://domainqa.unitedeffects.com',
    emailHook: process.env.SENDGRID_API_ID || 'SENDGRIDAPIID'
};

module.exports = config;