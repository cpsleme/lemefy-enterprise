const { createSharePolicyMiddleware } = require('@lemefy/api');
const { hasCapability } = require('~/server/middleware/roles/capabilities');
const { getRoleByName } = require('~/models');

module.exports = createSharePolicyMiddleware({
  getRoleByName,
  hasCapability,
});
