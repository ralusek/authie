'use strict';

const MODEL = 'password_reset_token';
const MODEL_PLURAL = 'password_reset_tokens';

const SCOPE = Object.freeze({});

// 1 hour
const EXPIRATION = 1000 * 60 * 60;

module.exports = Object.freeze({
  MODEL,
  MODEL_PLURAL,
  SCOPE,
  EXPIRATION
});
