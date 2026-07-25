const express = require('express');
const shareRoutes = require('./adapters/share');
const router = express.Router();

router.use(shareRoutes);

module.exports = router;
