const Sequelize = require('sequelize');

const CONSTANTS = require('./constants');

/**
 * Schema definition object.
 */
const DEFINITION_OBJECT = {
  id: {type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4},
  email: {type: Sequelize.STRING, allowNull: false},
  phone: {type: Sequelize.STRING},
  hashedPW: {
    type: Sequelize.STRING,
    allowNull: false,
    notEmpty: true
    // validate: {
    //   is: /^(?=.*\d).{6,}$/
    // }
  },
  password: {type: Sequelize.VIRTUAL},
  verified_email: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false}
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
  defaultScope: {
    attributes: {exclude: ['hashedPW']}
  },
  indexes : [
    {
      fields: ['email'],
      unique: true
    },
    {
      fields: ['phone'],
      unique: true
    },
    {
      fields: ['verified_email']
    }
  ]
};

/**
 * Schema relationships.
 */
const RELATIONSHIP_DEFINITIONS = {
  USER: models => {
    models.AuthUser.hasMany(models.AuthToken, {foreignKey: {allowNull: false}, onDelete: 'CASCADE'});
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
