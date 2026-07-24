const { createLoadConfigModels, fetchModels } = require('@lemefy/api');
const { getAppConfig } = require('./app');
const db = require('~/models');

const loadConfigModels = createLoadConfigModels({
  getAppConfig,
  getUserKeyValues: db.getUserKeyValues,
  fetchModels,
});

module.exports = loadConfigModels;
