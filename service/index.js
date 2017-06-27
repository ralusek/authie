'use strict';

const Promise = require('bluebird');
const Deferrari = require('deferrari');
const Cachie = require('cachie');
const jwt = require('jsonwebtoken');
const uuid4 = require('uuid4');

const sequelizeConnect = require('../database/sequelize');
const bootstrapModels = require('../dbi/models').bootstrap;

const MW = require('./middleware');

const CONNECTED = 'connected';

const CACHE = Object.freeze({
  TOKEN: 'login_token',
  COLLECTION: 'auth'
});


// This establishes a private namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}



/**
 * Authentication Service.
 */
module.exports = class AuthenticationService {
  /**
   *
   */
  constructor(config) {
    config && this.configure(config);

    p(this).deferrari = new Deferrari();

    this.MW = MW(this);
  }


  configure(config) {
    config = config || {};

    // It is highly recommended that the provider be the name of your application (i.e. 'dockit')
    p(this).provider = config.provider || 'application';
    p(this).tokenSecret = config.tokenSecret || 'DEFAULT_SECRET';
    p(this).tokenOptions = {
      issuer: config.tokenIssuer || 'DEFAULT_ISSUER'
    };
  }


  connect(config) {
    config = config || {};

    // Establish connections on behalf of service.
    p(this).sequelize = config.sequelizeClient || sequelizeConnect.newClient(config.db);

    // TODO use redis.
    p(this).modelCache = new Cachie({
      type: Cachie.TYPE.REDIS,
      collection: CACHE.COLLECTION
    });

    return Promise.join(
      sequelizeConnect.connect(p(this).sequelize),
      // Temp pass in actual credentials for redis cache.
      p(this).modelCache.connect(config.cache)
    )
    .spread(() => {
      // NEVER set force to true. It will wipe those tables.
      if (config.sync) p(this).sequelize.sync({force: false});
      // Set status as connected and allow usage of the service.
      // Bootstrap the models.
      return p(this).deferrari.resolve(CONNECTED, bootstrapModels(p(this).sequelize, p(this).modelCache));
    });
  }


  /**
   * Login with credentials to receive a authUser and token.
   */
  login(credentials) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      if (!credentials) return Promise.reject(new Error('Login requires credentials be provided'));

      return models.AuthUser.fetchByCredentials(credentials)
      .then(authUser => {
        // Generate token.
        return signToken({id: uuid4()}, p(this).tokenSecret, p(this).tokenOptions)
        // Create AuthToken in DB.
        .tap(token => models.AuthToken.create({token, auth_user_id: authUser.id, provider: p(this).provider}))
        // Go redundantly through verify token path to ensure consistentcy in
        // output. Everything is cached at this point.
        .then((token) => this.verifyToken(token));
      });
    });
  }


  /**
   *
   */
  signUp(credentials, fallback) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      if (!credentials) return Promise.reject(new Error('Sign Up requires credentials be provided'));

      return models.AuthUser.create(credentials, {password: credentials.password})
      .then(() => this.login(credentials))
      // Attempt to login if sign up fails if fallback is explicitly true.
      .catch(err => {
        if (fallback === true) return this.login(credentials);
        return Promise.reject(err);
      });
    });
  }


  /**
   * Verifies token, returns associated authUser and identities.
   */
  verifyToken(token) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      return Promise.join(
        // Verify that token is active and valid. Return token.
        models.AuthToken.fetchByTokenWithAuthUser(token),
        // Verify that provided token is valid signature.
        verifyJWT(token, p(this).tokenSecret, p(this).tokenOptions)
      )
      .spread(authToken => {
        if (!authToken) return Promise.reject(new Error('Token not found.'));
        if (!authToken.valid) return Promise.reject(new Error('Token invalid.'));
        
        return authToken;
      });
    });
  }


  /**
   * Invalidates token.
   */
  invalidateToken(token) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      if (!token) return Promise.reject('No token provided to invalidate.');
      return models.AuthToken.update({valid: false}, {
        where: {token},
        individualHooks: true,
        returning: true
      })
      .spread((affected, results) => results && results.length ? results[0].toJSON() : null);
    });
  }


  /**
   * Invalidate all by authUser.
   */
  invalidateAll(token) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      return this.verifyToken(token)
      .then(authToken => {
        return models.AuthToken.update({valid: false}, {
          where: {auth_user_id: authToken.auth_user_id, valid: true},
          individualHooks: true
        });
      });
    });
  }


  /**
   * Creates password reset token for a given email.
   */
  requestPasswordResetToken(email) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      return models.AuthUser.findOne({where: {email}})
      .then(authUser => {
        if (!authUser) return Promise.reject(new Error(`No AuthUser found for provided email ${email}. Cannot create reset token.`));
        return models.PasswordResetToken.create({auth_user_id: authUser.id});
      });
    });
  }


  /**
   * Redeem a password reset token. Can optionally provide an email, in which
   * case the email corresponding the token must match (extra security).
   */
  redeemPasswordResetToken(passwordResetToken, newPassword, optionalEmail) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      return p(this).sequelize.transaction(t => {
        const options = {transaction: t};
        return models.PasswordResetToken.redeem(passwordResetToken, options, optionalEmail)
        .then(passwordResetToken => {
          return models.AuthUser.updatePassword(passwordResetToken.auth_user_id, newPassword);
        });
      });
    });
  }


  /**
   * Update user email address
   */
  updateUserEmail(authUserId, email) {
    if (!email) return Promise.reject(new Error('Cannot updateUserEmail, no email provided.'));
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      return models.AuthUser.update(email, {
        where: {id: authUserId},
        individualHooks: true,
        returning: true
      });
    });
  }


  /**
   * Remove user for a given email address.
   */
  removeUser(email, strict) {
    if (!email) return Promise.reject(new Error('Cannot removeUser, no email provided.'));
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => models.AuthUser.destroy({where: {email}, individualHooks: true}))
    .tap(deletedCount => {
      if (!deletedCount && (strict === true)) return Promise.reject(new Error(`Failed to remove user: ${email}.`));
    });
  }
};



/**
 *
 */
function verifyJWT(token, secret, options) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, options, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}


/**
 *
 */
function signToken(payload, secret, options) {
  return new Promise((resolve, reject) => {
    jwt.sign(payload, secret, options, (err, token) => {
      if (err) return reject(err);
      resolve(token);
    });
  });
}
