'use strict';

const Promise = require('bluebird');

const CONSTANTS = require('./constants');
const SCOPE = CONSTANTS.SCOPE;


module.exports = (models, cache) => {

  const tokenCache = cache.childCollection({collection: CONSTANTS.MODEL});

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
   * Fetch token by token from cache, falling back on DB when unavailable.
   */
  behaviors.classMethods.fetchByToken = function(token) {
    return tokenCache.string.get(token, {unstringify: true})
    .then(authToken => {
      // If token found in cache, return.
      if (authToken) return authToken;

      // Cache miss. Fetch from DB and add to cache.
      return refreshCache(token);
    });
  };


  /**
   * Fetch by token but include associated user.
   */
  behaviors.classMethods.fetchByTokenWithAuthUser = function(token) {
    return this.fetchByToken(token)
    .then(authToken => {
      if (!authToken) return authToken;

      // Will fetch from cache, else DB.
      return models.AuthUser.fetchById(authToken.auth_user_id)
      .then(authUser => Object.assign(authToken, {authUser}));
    });
  };


/******************************************************************************/
/***************************** INSTANCE METHODS  ******************************/
/******************************************************************************/


/******************************************************************************/
/*********************************** HOOKS  ***********************************/
/******************************************************************************/

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


/******************************************************************************/
/***************************** HELPER FUNCTIONS  ******************************/
/******************************************************************************/

  function refreshCache(token) {
    token = token && token.token ? token.token : token;
    if (!token) return Promise.reject(new Error('No token provided for refresh.'));
    // Fetch again to ensure any appropriate DB scopes are applied.
    const query = {token};
    return models.AuthToken.findOne({where: {token}})
    .then(authToken => {
      if (!authToken) return Promise.reject(new Error('No token found for refresh.'));
      authToken = authToken.toJSON();
      return tokenCache.string.set(token, authToken, {
        returning: true,
        stringify: true,
        expiresAt: authToken.expiresAt
      });
    });
  }

  /**
   * Exports the Model behaviors.
   */
  return behaviors;
};
