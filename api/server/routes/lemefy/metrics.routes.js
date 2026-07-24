const { Router } = require('express');
const { logger } = require('@lemefy/data-schemas');

const router = Router();

router.get('/metrics/dora', async (req, res) => {
  try {
    const { team, periodStart, periodEnd } = req.query;
    if (!team || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'team, periodStart, and periodEnd are required' });
    }
    const metrics = await lemefyService.dora.getMetrics(team, periodStart, periodEnd);
    res.status(200).json({ metrics, team });
  } catch (error) {
    logger.error('[lemefy] Error fetching DORA metrics', error);
    res.status(500).json({ error: 'Error fetching DORA metrics' });
  }
});

router.get('/metrics/space', async (req, res) => {
  try {
    const { team, period } = req.query;
    if (!team || !period) {
      return res.status(400).json({ error: 'team and period are required' });
    }
    const metrics = await lemefyService.space.getMetrics(team, period);
    res.status(200).json({ metrics, team });
  } catch (error) {
    logger.error('[lemefy] Error fetching SPACE metrics', error);
    res.status(500).json({ error: 'Error fetching SPACE metrics' });
  }
});

module.exports = router;