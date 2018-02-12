const Sequelize = require('sequelize');

const CONSTANTS = require('./constants');

/**
 * Schema definition object.
 */
const DEFINITION_OBJECT = {
  id: {type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4},
  type: {type: Sequelize.STRING, allowNull: false},
  hash: {type: Sequelize.STRING, allowNull: false}
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
  createdAt: 'createdAt',
  updatedAt: false,
  indexes : [
    {
      fields: ['authUserId']
    },
    {
      fields: ['type']
    },
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
    models.PasswordHash.belongsTo(models.AuthUser, {foreignKey: {name: 'authUserId', allowNull: false}, onDelete: 'CASCADE'});
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
