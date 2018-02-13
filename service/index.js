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


  configure(config = {}) {
    // It is highly recommended that the provider be the name of your application (i.e. 'dockit')
    p(this).provider = config.provider || 'application';
    p(this).tokenSecret = config.tokenSecret || 'DEFAULT_SECRET';
    p(this).tokenOptions = {
      issuer: config.tokenIssuer || 'DEFAULT_ISSUER'
    };
    p(this).pepper = config.pepper;
  }


  connect(config = {}) {
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
      // WARNING: Setting Sync to "force" will WIPE the tables.
      if (config.sync) {
        p(this).sequelize.sync({force: config.sync === 'force'});
      }
      // Set status as connected and allow usage of the service.
      // Bootstrap the models.
      return p(this).deferrari.resolve(CONNECTED, bootstrapModels({
        sequelize: p(this).sequelize,
        cache: p(this).modelCache,
        config: {
          pepper: p(this).pepper
        }
      }));
    });
  }


  /**
   * Login with credentials to receive a authUser and token.
   */
  login({authUserId, password = {}} = {}) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      if (!authUserId) return Promise.reject(new Error('Login required authUserId to be provided'));
      if (!password.type) return Promise.reject(new Error('Login requires password.type to be provided'));
      if (!password.value) return Promise.reject(new Error('Login requires password.value to be provided'));

      return Promise.join(
        models.AuthUser.fetchById(authUserId),
        models.PasswordHash.verifyPassword({
          authUserId,
          password: {
            type: password.type,
            value: password.value
          }
        })
      )
      .spread((authUser) => this.generateToken(authUser.id));
    });
  }


  /**
   *
   */
  signUp({authUserId, password = {}} = {}, fallback) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      return models.AuthUser.create({id: authUserId}, {returning: true})
      .then(({id: authUserId}) => models.PasswordHash.setPassword({authUserId, password}))
      .then(() => this.login({authUserId, password}))
      // Attempt to login if sign up fails if fallback is explicitly true.
      .catch(err => {
        if (fallback === true) return this.login({authUserId, password})
        // We reject original error if fallback fails.
        .catch(newErr => Promise.reject(err));
        return Promise.reject(err);
      });
    });
  }


  /**
   *
   */
  addPassword({authUserId, password = {}} = {}) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      if (!password.type) return Promise.reject(new Error('Cannot add a new password without specifying a password type.'));
      return models.PasswordHash.setPassword({authUserId, password});
    });
  }


  /**
   *
   */
  generateToken(authUserId) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      // Generate token.
      return signToken({id: uuid4(), authUserId}, p(this).tokenSecret, p(this).tokenOptions)
      // Create AuthToken in DB.
      .tap(token => models.AuthToken.create({token, authUserId, provider: p(this).provider}))
      // Go redundantly through verify token path to ensure consistentcy in
      // output. Everything is cached at this point.
      .then((token) => this.verifyToken(token));
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
          where: {authUserId: authToken.authUserId, valid: true},
          individualHooks: true
        });
      });
    });
  }


  /**
   * Creates password reset token for a given authUserId.
   */
  requestPasswordResetToken(authUserId) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      return models.AuthUser.findById(authUserId)
      .then(authUser => {
        if (!authUser) return Promise.reject(new Error(`No AuthUser found for provauthUserIded authUserId ${authUserId}. Cannot create reset token.`));
        return models.PasswordResetToken.create({authUserId});
      });
    });
  }


  /**
   * Redeem a password reset token. Can optionally provide an id, in which
   * case the id corresponding the token must match (extra security).
   */
  redeemPasswordResetToken(passwordResetToken, newPassword, optionalEmail) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => {
      return p(this).sequelize.transaction(t => {
        const options = {transaction: t};
        return models.PasswordResetToken.redeem(passwordResetToken, options, optionalEmail)
        .then(passwordResetToken => {
          return models.AuthUser.updatePassword(passwordResetToken.authUserId, newPassword);
        });
      });
    });
  }


  /**
   * Remove user for a given id address.
   */
  removeUser(id, strict) {
    if (!id) return Promise.reject(new Error('Cannot removeUser, no id provided.'));
    return p(this).deferrari.deferUntil(CONNECTED)
    .then(models => models.AuthUser.destroy({where: {id}, individualHooks: true}))
    .tap(deletedCount => {
      if (!deletedCount && (strict === true)) return Promise.reject(new Error(`Failed to remove user: ${id}.`));
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
