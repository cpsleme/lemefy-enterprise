const {
  GenerationJobManager,
  createMessageRequestMiddleware,
  isPendingActionStale,
} = require('@lemefy/api');
const { logger } = require('@lemefy/data-schemas');
const { getConvo } = require('~/models');

module.exports = createMessageRequestMiddleware({
  getConvo,
  getJob: (conversationId) => GenerationJobManager.getJob(conversationId),
  isPendingActionStale,
  logger,
});
