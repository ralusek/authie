'use strict';

const Promise = require('bluebird');
const bcrypt = require('bcryptjs');

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


/******************************************************************************/
/***************************** INSTANCE METHODS  ******************************/
/******************************************************************************/


/******************************************************************************/
/*********************************** HOOKS  ***********************************/
/******************************************************************************/

  /**
   *
   */
  behaviors.hooks.beforeCreate = [
    ({id}) => {
      if (!id) return Promise.reject(new Error('Cannot create authUser without providing an id.'));
    }
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



/******************************************************************************/
/***************************** HELPER FUNCTIONS  ******************************/
/******************************************************************************/

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
