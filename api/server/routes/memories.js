const express = require('express');
const memoriesRoutes = require('./adapters/memories');
const router = express.Router();

router.use(memoriesRoutes);

module.exports = router;
