const Sequelize = require('sequelize');

const CONSTANTS = require('./constants');

/**
 * Schema definition object.
 */
const DEFINITION_OBJECT = {
  id: {type: Sequelize.UUID, primaryKey: true}
};

/**
 * Schema configuration.
 */
const CONFIGURATION_OBJECT = {
  tableName: CONSTANTS.MODEL_PLURAL,
  name: {
    singular: CONSTANTS.MODEL,
    plural: CONSTANTS.MODEL_PLURAL
  },
  timestamps: true,
  indexes : [
    {
      fields: [{attribute: 'createdAt', order: 'DESC'}]
    }
  ]
};

/**
 * Schema relationships.
 */
const RELATIONSHIP_DEFINITIONS = {
  USER: models => {
    models.AuthUser.hasMany(models.AuthToken, {foreignKey: {allowNull: false}, onDelete: 'CASCADE'});
    models.AuthUser.hasMany(models.PasswordHash, {foreignKey: {name: 'authUserId', allowNull: false}, onDelete: 'CASCADE'});
    models.AuthUser.hasMany(models.PasswordResetToken, {foreignKey: {allowNull: false}, onDelete: 'CASCADE'});
  }
};


/**
 *
 */
module.exports = Object.freeze({
  DEFINITION_OBJECT,
  CONFIGURATION_OBJECT,
  RELATIONSHIP_DEFINITIONS
});
