'use strict';

const Promise = require('bluebird');
const bcrypt = require('bcryptjs');

const CONSTANTS = require('./constants');


module.exports = (models, cache, {pepper = ''} = {}) => {

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
   *
   */
  behaviors.classMethods.setPassword = ({authUserId, password}) => {
    return generateHashFromPassword({password: password.value, salt: authUserId})
    .then(hash => models.PasswordHash.create({authUserId, hash, type: password.type}, {returning: true}));
  };


  /**
   *
   */
  behaviors.classMethods.verifyPassword = ({authUserId, password}) => {
    return models.PasswordHash.findOne({
      where: {
        authUserId,
        type: password.type
      },
      order: [['createdAt', 'DESC']]
    })
    .then(({hash: existing} = {}) => {
      if (!existing) return Promise.reject(`Could not verify password, none found of type ${password.type}.`);

      return checkPassword({
        password: {
          existing,
          provided: password.value
        },
        salt: authUserId
      });
    });
  };


/******************************************************************************/
/***************************** INSTANCE METHODS  ******************************/
/******************************************************************************/


/******************************************************************************/
/*********************************** HOOKS  ***********************************/
/******************************************************************************/


/******************************************************************************/
/********************************** SCOPES  ***********************************/
/******************************************************************************/


/******************************************************************************/
/***************************** HELPER FUNCTIONS  ******************************/
/******************************************************************************/

  /**
   *
   */
  function generateHashFromPassword({password, salt}){
    return new Promise((resolve, reject) => {
      bcrypt.genSalt(CONSTANTS.SALT_WORK_FACTOR, (err, bcryptSalt) => {
        if (err) return reject(err);

        const seasoned = addSeasoning(password, {salt});
        bcrypt.hash(seasoned, bcryptSalt, (error, hash) => {
          if (error) return reject(error);

          resolve(hash);
        });
      });
    });
  }

  /**
   *
   */
  function checkPassword({password: {provided, existing}, salt}) {
    return new Promise((resolve, reject) => {
      const seasoned = addSeasoning(provided, {salt});
      bcrypt.compare(seasoned, existing, (err, isMatch) => {
        if (err) return reject(new Error('Error occurred checking password.' + err.stack));
        if (!isMatch) return reject(new Error('Provided password does not match existing.'));
        resolve();
      });
    });
  }

  /**
   *
   */
  function addSeasoning(password, {salt = ''}) {
    return password + salt + pepper;
  }

  /**
   * Exports the Model behaviors.
   */
  return behaviors;
};
