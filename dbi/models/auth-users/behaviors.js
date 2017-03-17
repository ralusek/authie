'use strict';

const Promise = require('bluebird');
const bcrypt = require('bcryptjs');
const emailValidator = require('email-validator');

const CONSTANTS = require('./constants');
const SCOPE = CONSTANTS.SCOPE;


module.exports = (models, cache) => {

  const authUserCache = cache.childCollection({collection: CONSTANTS.MODEL});

  const behaviors = {
    classMethods: {},
    instanceMethods: {},
    hooks: {},
    scopes: {}
  };


/******************************************************************************/
/******************************* CLASS METHODS  *******************************/
/******************************************************************************/

  /**
   * Fetch authUser by id from cache, falling back on DB when unavailable.
   */
  behaviors.classMethods.fetchById = function(id) {
    return authUserCache.string.get(id, {unstringify: true})
    .then(authUser => {
      // If authUser found in cache, return.
      if (authUser) return authUser;

      // Cache miss. Fetch from DB and add to cache.
      return refreshCache({id});
    });
  };


  /**
   *
   */
  behaviors.classMethods.fetchByCredentials = function(credentials, options) {
    const query = {};
    if (!credentials.password) return Promise.reject(new Error('Login requires password be provided.'));

    if (credentials.email) query.email = credentials.email;
    else if (credentials.phone) query.phone = credentials.phone;
    else return Promise.reject(new Error('No credentials provided.'));

    return this.scope(SCOPE.INCLUDE_PW).findOne({where: query})
    .tap(authUser => {
      if (!authUser) return Promise.reject(new Error(`No authUser found matching provided credentials: ${JSON.stringify(query)}`));

      // Check password.
      const provided = credentials.password;
      return checkPassword(provided, authUser.hashedPW);
    })
    .then(authUser => {
      authUser = authUser.toJSON();
      delete authUser.hashedPW;
      return authUser;
    });
  };


  /**
   *
   */
  behaviors.classMethods.updatePassword = function(auth_user_id, newPassword, options) {
    return this.hashPassword({password: newPassword}, options)
    .then(modified => this.update(modified, {
      where: {id: auth_user_id},
      returning: true
    }))
    .spread((updateCount, values) => values[0]);
  };


  /**
   *
   */
  behaviors.classMethods.hashPassword = function(authUser, options) {
    if (!authUser.password) return Promise.reject(new Error('No password provided.'));

    return generateHashFromPassword(authUser.password)
    .then(hash => {
      authUser.hashedPW = hash;
      return authUser;
    });
  };


/******************************************************************************/
/***************************** INSTANCE METHODS  ******************************/
/******************************************************************************/


/******************************************************************************/
/*********************************** HOOKS  ***********************************/
/******************************************************************************/

  /**
   * Before Validate hooks.
   */
  behaviors.hooks.beforeValidate = [
    // Require email.
    (authUser, options) => {
      if (!authUser.email) return Promise.reject(new Error('AuthUser email required.'));
    },
    // Format email.
    (authUser, options) => {
      if (authUser.email) authUser.email = authUser.email.trim();
    },
    // Validate email.
    (authUser, options) => {
      if (!emailValidator.validate(authUser.email)) {
        return Promise.reject(new Error(`${authUser.email} is not a valid email address.`));
      }
    }
  ];


  /**
   * Before Create hooks.
   */
  behaviors.hooks.beforeCreate = [
    // Hash password.
    (authUser, options) => models.AuthUser.hashPassword(authUser, options)
  ];


  /**
   * After Create hooks.
   */
  behaviors.hooks.afterCreate = [
    // Update cache after create.
    refreshCache
  ];


  /**
   * After Update hooks.
   */
  behaviors.hooks.afterUpdate = [
    // Update cache after create.
    refreshCache
  ];

/******************************************************************************/
/********************************** SCOPES  ***********************************/
/******************************************************************************/

  /**
   *
   */
  behaviors.scopes[SCOPE.INCLUDE_PW] = () => ({
    attributes: {include: ['hashedPW']}
  });

/******************************************************************************/
/***************************** HELPER FUNCTIONS  ******************************/
/******************************************************************************/

  /**
   *
   */
  function generateHashFromPassword(password){
    return new Promise((resolve, reject) => {
      bcrypt.genSalt(CONSTANTS.SALT_WORK_FACTOR, (err, salt) => {
        if (err) return reject(err);

        // hash the password along with our new salt
        bcrypt.hash(password, salt, (error, hash) => {
          if (error) return reject(error);

          resolve(hash);
        });
      });
    })
  }

  /**
   *
   */
  function checkPassword(provided, existing) {
    return new Promise((resolve, reject) => {
      bcrypt.compare(provided, existing, (err, isMatch) => {
        if (err) return reject(new Error('Error occurred checking password.' + err.stack));
        if (!isMatch) return reject(new Error('Provided password does not match existing.'));
        resolve();
      });
    });
  }

  /**
   *
   */
  function refreshCache(authUser) {
    // Fetch again to ensure any appropriate DB scopes are applied.
    return models.AuthUser.findById(authUser.id)
    .then(authUser => {
      authUser = authUser.toJSON ? authUser.toJSON() : authUser;
      return authUserCache.string.set(authUser.id, authUser, {
        returning: true,
        stringify: true
      });
    });
  }

  /**
   * Exports the Model behaviors.
   */
  return behaviors;
};
