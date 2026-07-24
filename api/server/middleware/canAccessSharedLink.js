const mongoose = require('mongoose');
const { createSharedLinkAccessMiddleware } = require('@lemefy/api');

const canAccessSharedLink = createSharedLinkAccessMiddleware({ mongoose });

module.exports = canAccessSharedLink;
