const mongoose = require('mongoose');
const { createModels } = require('@lemefy/data-schemas');

const USE_POSTGRES_ALL = process.env.USE_POSTGRES_ALL === 'true';

// createModels MUST run before requiring indexSync.
// indexSync.js captures mongoose.models.Message and mongoose.models.Conversation
// at module load time. If those models are not registered first, all MeiliSearch
// sync operations will silently fail on every startup.
if (!USE_POSTGRES_ALL) {
  createModels(mongoose);
  const { connectDb } = require('./connect');
  const indexSync = require('./indexSync');
  module.exports = { connectDb, indexSync };
} else {
  // When using PostgreSQL exclusively, provide a no-op connectDb
  const connectDb = async () => {
    const { logger } = require('@lemefy/data-schemas');
    logger.info('[connectDb] Using PostgreSQL for all data (USE_POSTGRES_ALL=true)');
  };
  module.exports = { connectDb, indexSync: async () => {} };
}
