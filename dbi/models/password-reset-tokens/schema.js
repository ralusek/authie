const Sequelize = require('sequelize');

const CONSTANTS = require('./constants');

/**
 * Schema definition object.
 */
const DEFINITION_OBJECT = {
  token: {type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4},
  expiresAt: {type: Sequelize.DATE, allowNull: false},
  redeemedAt: {type: Sequelize.DATE},
  invalidatedAt: {type: Sequelize.DATE}
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
  underscored: true,
  indexes : [
    {
      fields: ['auth_user_id']
    },
    {
      fields: ['expiresAt']
    },
    {
      fields: ['redeemedAt']
    },
    {
      fields: ['invalidatedAt']
    }
  ]
};

/**
 * Schema relationships.
 */
const RELATIONSHIP_DEFINITIONS = {
  USER: models => {
    models.PasswordResetToken.belongsTo(models.AuthUser, {foreignKey: {allowNull: false}, onDelete: 'CASCADE'});
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
