'use strict';

const Promise = require('bluebird');
const _ = require('lodash');

const CONSTANTS = require('./constants');
const SCOPE = CONSTANTS.SCOPE;


module.exports = (models) => {

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
   * Attempt to redeem a token
   */
  behaviors.classMethods.redeem = function(token, options, optionalEmail) {
    options = Object.assign(options || {}, {where: {token}});

    // Performs join if optional email is provided so as to include AuthUser.
    // Rather than inner join filtering, we just check the response so that we
    // can give a better error message.
    if (optionalEmail) options.include = [{model: models.AuthUser, as: 'authUser'}];

    return this.findOne(options)
    .then(resetToken => {
      if (!resetToken) return Promise.reject(new Error('Token provided is not a valid reset token.'));
      // Check if token is invalid.
      if (resetToken.invalidatedAt) return Promise.reject(new Error('Password Reset Token was invalided.'));
      // Check if token has already been redeemed.
      if (resetToken.redeemedAt) return Promise.reject(new Error('Password Reset Token has already been redeemed.'));
      // Check if token is expired.
      const expiresAt = new Date(resetToken.expiresAt).getTime();
      if (Date.now() > expiresAt) return Promise.reject(new Error('Provided token is expired.'));

      // If optional email was provided, here is where we check to ensure that it
      // matches user associated with the reset token.
      if (optionalEmail && (_.get(resetToken, 'authUser.email') !== optionalEmail)) {
        return Promise.reject(new Error(`Password Reset Token not associated with provided email: ${optionalEmail}`));
      }

      // Redeem token.
      options.returning = true;
      options.individualHooks = true;
      return this.update({redeemedAt: Date.now()}, options)
      .spread((updateCount, values) => values[0]);
    });
  };


  /**
   *
   */
  behaviors.classMethods.invalidateAll = function(auth_user_id, options) {
    if (!auth_user_id) return Promise.reject(new Error('Password Reset Tokens invalidateAll requires auth_user_id be provided.'));

    options = options || {};
    options.where = {
      auth_user_id: auth_user_id,
      invalidatedAt: null,
      redeemedAt: null,
      expiresAt: {$gt: now}
    };

    return models.PasswordResetToken.update({invalidatedAt: now}, options);
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
  behaviors.hooks.beforeValidate = [
    // Set token expiration.
    (content, options) => {
      if (!content.expiresAt) content.expiresAt = new Date(Date.now() + CONSTANTS.EXPIRATION);
    }
  ];

  /**
   *
   */
  behaviors.hooks.beforeCreate = [
    // Invalidate all existing, valid tokens for the user.
    (content, options) => {
      options = {transaction: _.get(options, 'transaction')};
      return models.PasswordResetToken.invalidateAll(_.get(content, 'auth_user_id'), options);
    }
  ];

  /**
   *
   */
  behaviors.hooks.afterUpdate = [
    (instance, options) => {
      options = {transaction: _.get(options, 'transaction')};
      return models.AuthToken.invalidateAll(_.get(instance, 'auth_user_id'), options);
    }
  ];

/******************************************************************************/
/********************************** SCOPES  ***********************************/
/******************************************************************************/


/******************************************************************************/
/***************************** HELPER FUNCTIONS  ******************************/
/******************************************************************************/


  /**
   * Exports the Model behaviors.
   */
  return behaviors;
};
