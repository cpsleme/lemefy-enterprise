const express = require('express');
const accessPermissionsRoutes = require('./adapters/accessPermissions');
const router = express.Router();

router.use(accessPermissionsRoutes);

module.exports = router;
