const express = require('express');
const oauthRoutes = require('./adapters/oauth');
const router = express.Router();

router.use(oauthRoutes);

module.exports = router;
