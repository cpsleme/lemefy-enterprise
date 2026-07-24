const { Router } = require('express');
const { logger } = require('@lemefy/data-schemas');

const router = Router();

router.get('/finops/report', async (req, res) => {
  try {
    const { projectId, team, provider, periodStart, periodEnd, currency } = req.query;
    const report = await lemefyService.finops.getCostReport({
      projectId: projectId,
      team: team,
      provider: provider,
      periodStart: periodStart,
      periodEnd: periodEnd,
      currency: currency,
    });
    res.status(200).json(report);
  } catch (error) {
    logger.error('[lemefy] Error generating FinOps report', error);
    res.status(500).json({ error: 'Error generating FinOps report' });
  }
});

router.get('/finops/recommendations', async (req, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    const recommendations = await lemefyService.finops.getRecommendations(projectId);
    res.status(200).json({ recommendations, count: recommendations.length });
  } catch (error) {
    logger.error('[lemefy] Error fetching recommendations', error);
    res.status(500).json({ error: 'Error fetching recommendations' });
  }
});

router.get('/finops/cost-by-service', async (req, res) => {
  try {
    const { projectId, periodStart, periodEnd } = req.query;
    if (!projectId || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'projectId, periodStart, and periodEnd are required' });
    }
    const breakdown = await lemefyService.finops.getCostByService(projectId, periodStart, periodEnd);
    res.status(200).json({ breakdown, total: breakdown.reduce((sum, b) => sum + b.cost, 0) });
  } catch (error) {
    logger.error('[lemefy] Error fetching cost by service', error);
    res.status(500).json({ error: 'Error fetching cost by service' });
  }
});

router.post('/finops/ingest', async (req, res) => {
  try {
    const { provider, credentials, projectId, costCenter, periodStart, periodEnd } = req.body;
    if (!provider || !projectId || !periodStart || !periodEnd) {
      return res.status(400).json({
        error: 'provider, projectId, periodStart, and periodEnd are required',
      });
    }

    const entries = await lemefyService.finops.ingestProviderCosts(
      provider,
      credentials,
      projectId,
      costCenter ?? 'default',
      periodStart,
      periodEnd,
      req.body.granularity ?? 'DAILY',
    );

    await lemefyService.finops.ingestCostData(entries);
    res.status(201).json({ ingested: entries.length, entries });
  } catch (error) {
    logger.error('[lemefy] Error ingesting FinOps costs', error);
    res.status(500).json({ error: 'Error ingesting FinOps costs' });
  }
});

module.exports = router;