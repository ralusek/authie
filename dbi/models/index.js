'use strict';

const _ = require('lodash');


/**
 *
 */
module.exports.bootstrap = (sequelize, cache) => {
  const models = {};
  Object.assign(models, {
    AuthToken: initModel('auth-tokens', models),
    PasswordResetToken: initModel('password-reset-tokens', models),
    AuthUser: initModel('auth-users', models)
  });

  _.forEach(models, model => model.establishRelationships());

  function initModel(modelName) {
    const behaviors = require(`./${modelName}/behaviors`)(models, cache);
    const schema = require(`./${modelName}/schema`);
    const CONSTANTS = require(`./${modelName}/constants`);

    const Model = sequelize.define(
      CONSTANTS.MODEL,
      schema.DEFINITION_OBJECT,
      // Add behaviors to schema definition.
      Object.assign({}, schema.CONFIGURATION_OBJECT, behaviors)
    );

    Model.establishRelationships = () => {
      _.forOwn(schema.RELATIONSHIP_DEFINITIONS, (establishRelationship, key) => {
        establishRelationship(models);
      });
    };

    return Model;
  }

  return models;
};
