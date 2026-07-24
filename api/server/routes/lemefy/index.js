const { Router } = require('express');
const { logger } = require('@lemefy/data-schemas');
const { lemefyService } = require('@lemefy/api');

const router = Router();

require('./lemefy/finops.routes')(router);
require('./lemefy/governance.routes')(router);
require('./lemefy/projects.routes')(router);
require('./lemefy/workflows.routes')(router);
require('./lemefy/rag.routes')(router);
require('./lemefy/metrics.routes')(router);

module.exports = router;