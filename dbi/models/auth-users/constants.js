'use strict';

const MODEL = 'auth_user';
const MODEL_PLURAL = 'auth_users';

const SCOPE = Object.freeze({
  INCLUDE_PW: 'includePW'
});

module.exports = Object.freeze({
  MODEL,
  MODEL_PLURAL,
  SCOPE,

  SALT_WORK_FACTOR
});
