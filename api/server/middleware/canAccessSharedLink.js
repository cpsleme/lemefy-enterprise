const { createSharedLinkAccessMiddleware } = require('@lemefy/api');

// When USE_POSTGRES_ALL is enabled, we need to provide a PostgreSQL-compatible implementation
// For now, use a stub since shared link access with PostgreSQL is not yet implemented
const USE_POSTGRES_ALL = process.env.USE_POSTGRES_ALL === 'true';

if (USE_POSTGRES_ALL) {
  // Return a no-op middleware for now
  // TODO: Implement PostgreSQL version of createSharedLinkAccessMiddleware
  const canAccessSharedLink = (req, res, next) => {
    // For now, just pass through - this needs proper implementation
    next();
  };
  module.exports = canAccessSharedLink;
} else {
  const mongoose = require('mongoose');
  const canAccessSharedLink = createSharedLinkAccessMiddleware({ mongoose });
  module.exports = canAccessSharedLink;
}
