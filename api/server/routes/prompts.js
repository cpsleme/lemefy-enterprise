const express = require('express');
const promptsRoutes = require('./adapters/prompts');
const router = express.Router();

router.use(promptsRoutes);

module.exports = router;
