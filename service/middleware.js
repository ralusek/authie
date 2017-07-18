'use strict';

const _ = require('lodash');

module.exports = (service) => {
  const MW = {};

  MW.bearer = (req, res, next) => {
    // Check if auth user is already present on the request.
    if (_.get(req, 'authUser')) return next();
    let token = req.headers.authorization || req.query.token;
    if (!token || !token.length) return next();

    token = token.replace(/Bearer */, '');

    service.verifyToken(token)
    .then(appendToRequest(req, next))
    .catch(err => next(err));
  };


  MW.enforceAuth = _.flatten([
    MW.bearer,
    (req, res, next) => {
      const authUserId = _.get(req, 'authUser.id');
      if (!authUserId) {
        return next(new Error('Unauthorized.'));
      }
      next();
    }
  ]);


  MW.login = _.flatten([
    (req, res, next) => {
      service.login(req.body)
      .then(appendToRequest(req, next))
      .catch(err => next(err));
    },
    MW.enforceAuth
  ]);


  MW.authorizeThirdParty = _.flatten([
    (req, res, next) => {
      service.authorizeThirdParty(req.body.code, req.body.provider)
      .then(appendToRequest(req, next))
      .catch(err => next(err));
    }
  ])

  return MW;
};

const appendToRequest = (req, next) => {
  return authToken => {
    req.authToken = authToken;
    req.authUser = _.get(authToken, 'authUser');
    next();
  };
};
