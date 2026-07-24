const { Router } = require('express');
const { logger } = require('@lemefy/data-schemas');

const router = Router();

router.get('/governance/policies', async (req, res) => {
  try {
    const { standard } = req.query;
    const policies = await lemefyService.governance.getPolicies(standard);
    res.status(200).json({ policies, count: policies.length });
  } catch (error) {
    logger.error('[lemefy] Error fetching policies', error);
    res.status(500).json({ error: 'Error fetching policies' });
  }
});

router.get('/governance/policies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await lemefyService.governance.getPolicy(id);
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.status(200).json(policy);
  } catch (error) {
    logger.error('[lemefy] Error fetching policy', error);
    res.status(500).json({ error: 'Error fetching policy' });
  }
});

router.patch('/governance/policies/:id/controls/:controlId', async (req, res) => {
  try {
    const { id, controlId } = req.params;
    const updates = req.body;
    const control = await lemefyService.governance.updateControl(id, controlId, updates);
    if (!control) {
      return res.status(404).json({ error: 'Control not found' });
    }
    res.status(200).json(control);
  } catch (error) {
    logger.error('[lemefy] Error updating control', error);
    res.status(500).json({ error: 'Error updating control' });
  }
});

router.get('/governance/compliance/:policyId', async (req, res) => {
  try {
    const { policyId } = req.params;
    const result = await lemefyService.governance.checkCompliance(policyId);
    res.status(200).json(result);
  } catch (error) {
    logger.error('[lemefy] Error checking compliance', error);
    res.status(500).json({ error: 'Error checking compliance' });
  }
});

router.get('/governance/compliance', async (_req, res) => {
  try {
    const results = await lemefyService.governance.assessAllPolicies();
    res.status(200).json({ results, totalPolicies: results.length });
  } catch (error) {
    logger.error('[lemefy] Error assessing compliance', error);
    res.status(500).json({ error: 'Error assessing compliance' });
  }
});

module.exports = router;