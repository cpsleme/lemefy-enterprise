const { Router } = require('express');
const { logger } = require('@lemefy/data-schemas');

const router = Router();

router.get('/workflows/flows', async (req, res) => {
  try {
    const { deploymentId, status, limit } = req.query;
    const result = lemefyService.prefect.handler.callTool('list_flows', {
      deploymentId,
      status,
      limit: limit ? parseInt(limit, 10) : 25,
    });
    res.status(200).json(result);
  } catch (error) {
    logger.error('[lemefy] Error listing flows', error);
    res.status(500).json({ error: 'Error listing flows' });
  }
});

router.post('/workflows/flows/:deploymentId/trigger', async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const { parameters, wait } = req.body;
    const result = await lemefyService.prefect.handler.callTool('trigger_flow', {
      deploymentId,
      parameters,
      wait: wait ?? false,
    });
    res.status(200).json(result);
  } catch (error) {
    logger.error('[lemefy] Error triggering flow', error);
    res.status(500).json({ error: 'Error triggering flow' });
  }
});

router.get('/workflows/runs', async (req, res) => {
  try {
    const { deploymentId, status, limit, startTime, endTime } = req.query;
    const result = lemefyService.prefect.handler.callTool('list_runs', {
      deploymentId,
      status,
      limit: limit ? parseInt(limit, 10) : 25,
      startTime,
      endTime,
    });
    res.status(200).json(result);
  } catch (error) {
    logger.error('[lemefy] Error listing runs', error);
    res.status(500).json({ error: 'Error listing runs' });
  }
});

router.get('/workflows/runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const result = lemefyService.prefect.handler.callTool('get_run', { runId });
    res.status(200).json(result);
  } catch (error) {
    logger.error('[lemefy] Error getting run', error);
    res.status(500).json({ error: 'Error getting run' });
  }
});

router.get('/workflows/flows/:flowId', async (req, res) => {
  try {
    const { flowId } = req.params;
    const result = lemefyService.prefect.handler.callTool('get_flow', { flowId });
    res.status(200).json(result);
  } catch (error) {
    logger.error('[lemefy] Error getting flow', error);
    res.status(500).json({ error: 'Error getting flow' });
  }
});

module.exports = router;