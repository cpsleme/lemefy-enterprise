const express = require('express');
const mcpRoutes = require('./adapters/mcp');
const router = express.Router();

router.use(mcpRoutes);

module.exports = router;
