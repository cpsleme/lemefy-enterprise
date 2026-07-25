const { Router } = require('express');
const { logger } = require('@lemefy/data-schemas');
const { lemefyService } = require('@lemefy/api');

const router = Router();

router.use(require('./finops.routes'));
router.use(require('./governance.routes'));
router.use(require('./projects.routes'));
router.use(require('./workflows.routes'));
router.use(require('./rag.routes'));
router.use(require('./metrics.routes'));

module.exports = router;