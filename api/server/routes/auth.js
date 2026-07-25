const express = require('express');
const authRoutes = require('./adapters/auth');
const router = express.Router();

router.use(authRoutes);

module.exports = router;
