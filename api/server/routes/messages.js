const express = require('express');
const messagesRoutes = require('./adapters/messages');
const router = express.Router();

router.use(messagesRoutes);

module.exports = router;
