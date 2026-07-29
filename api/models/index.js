const { logger } = require('@lemefy/data-schemas');

// Check if we should use PostgreSQL for everything
const USE_POSTGRES_ALL = process.env.USE_POSTGRES_ALL === 'true';

if (USE_POSTGRES_ALL) {
  logger.info('[models] Using PostgreSQL for all models (USE_POSTGRES_ALL=true)');
  const postgresModels = require('./postgres-all');
  module.exports = postgresModels;
} else {
  // Use Mongoose-based models (default)
  const mongoose = require('mongoose');
  const { createMethods } = require('@lemefy/data-schemas');
  const { matchModelName, findMatchingPattern, isDeploymentSkillId } = require('@lemefy/api');
  const getLogStores = require('~/cache/getLogStores');

  const methods = createMethods(mongoose, {
    matchModelName,
    findMatchingPattern,
    isExternalSkillId: isDeploymentSkillId,
    getCache: getLogStores,
  });

  const seedDatabase = async () => {
    await methods.initializeRoles();
    await methods.seedDefaultRoles();
    await methods.ensureDefaultCategories();
    await methods.seedSystemGrants();
  };

  module.exports = {
    ...methods,
    seedDatabase,
  };
}
