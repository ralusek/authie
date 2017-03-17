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
    if (optionalEmail) options.include = [{model: models.AuthUser}];

    return this.findOne(options)
    .then(resetToken => {
      if (!resetToken) return Promise.reject(new Error('Token provided is not a valid reset token.'));
      // Check if token has already been redeemed.
      if (resetToken.redeemed) return Promise.reject(new Error('Password Reset Token has already been redeemed.'));
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
      return this.update({redeemed: true}, options)
      .spread((updateCount, values) => values[0]);
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
    // Ensure that no pending password reset tokens are out for the current user.
    (content, options) => {
      return models.PasswordResetToken.findOne({
        where : {
          auth_user_id: content.auth_user_id,
          redeemed: false,
          expiresAt: { $gt: Date.now() }
        }
      })
      .then(passwordResetToken => {
        if (passwordResetToken) {
          return Promise.reject(new Error('There is already an unexpired, unredeemed password reset token out for this user.'));
        }
      })
      .return(content);
    },

    // Set token expiration.
    (content, options) => {
      content.expiresAt = new Date(Date.now() + CONSTANTS.EXPIRATION);
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
