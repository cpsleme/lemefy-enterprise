const express = require('express');
const skillsRoutes = require('./adapters/skills');
const router = express.Router();

router.use(skillsRoutes);

module.exports = router;
