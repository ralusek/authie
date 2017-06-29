const Sequelize = require('sequelize');

const CONSTANTS = require('./constants');

/**
 * Schema definition object.
 */
const DEFINITION_OBJECT = {
  id: {type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4},
  provider: {type: Sequelize.STRING, allowNull: false},
  token: {type: Sequelize.TEXT, allowNull: false},
  refreshToken: {type: Sequelize.STRING},
  expiresAt: {type: Sequelize.DATE},
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
      fields: ['provider']
    },
    {
      fields: ['invalidatedAt']
    },
    {
      fields: ['token'],
      unique: true
    },
    {
      fields: ['refreshToken'],
      unique: true
    },
    {
      fields: ['expiresAt']
    }
  ]
};

/**
 * Schema relationships.
 */
const RELATIONSHIP_DEFINITIONS = {
  USER: models => {
    models.AuthToken.belongsTo(models.AuthUser, {foreignKey: {allowNull: false}, onDelete: 'CASCADE'});
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
