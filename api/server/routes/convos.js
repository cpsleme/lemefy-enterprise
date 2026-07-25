const express = require('express');
const convosRoutes = require('./adapters/convos');
const router = express.Router();

router.use(convosRoutes);

module.exports = router;
