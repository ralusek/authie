'use strict';

const pg = require('pg');
const Sequelize = require('sequelize');
const Promise = require('bluebird');
const _  = require('lodash');
const winston = require('winston');


const DEFAULT_CONFIG = {
  dialect: 'postgres',
  host: 'localhost',
  port: 5432,
  pool: {
    max: 5,
    min: 0,
    idle: 1000
  },
  define: {
    timestamps: true
  },
  logging: false
};


module.exports.newClient = (config) => {
  config = config || {};
  config.client = config.client || {};

  const db = _.get(config, 'db');
  const user = _.get(config, 'user');

  const clientConfig = Object.assign({}, DEFAULT_CONFIG, config.client);

  if (_.get(clientConfig, 'replication')) {
    const write = _.get(clientConfig, 'replication.write');
    if (!write) throw new Error('Write not specified for replication config.');
    write.username = write.username || user;
    write.host = write.host || clientConfig.host;
    write.password = write.password || clientConfig.password;
    write.pool = write.pool || clientConfig.pool || {};

    let reads = _.get(clientConfig, 'replication.read') || Object.assign({}, write);
    reads = (Array.isArray(reads) ? reads : [reads]).map(read => {
      read.username = read.username || user;
      read.host = read.host || clientConfig.host;
      read.password = read.password || clientConfig.password;
      read.pool = read.pool || clientConfig.pool || {};
      return read;
    });
    _.set(clientConfig, 'replication.read', reads);

    return new Sequelize(db, user, config.pass, clientConfig);
  }
  
  return new Sequelize(db, user, config.pass, clientConfig);
};


module.exports.connect = (client) => {
  const dialect = client.connectionManager.dialectName;
  const db = client.connectionManager.config.database;

  return Promise.resolve(client.authenticate())
  .then(() => {
    winston.info(`${dialect}:${db} connection successfully established.`);
    return client;
  })
  .catch((err) => {
    winston.error(`Error connecting to ${dialect}:${db}.`);
    return Promise.reject(err);
  });
};
