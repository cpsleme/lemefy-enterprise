import { governanceService } from '../service';

describe('governanceService', () => {
  describe('getPolicies', () => {
    it('should return all policies by default', async () => {
      const policies = await governanceService.getPolicies();
      expect(policies.length).toBeGreaterThan(0);
      expect(policies.every((p) => p.standard === 'FINOS')).toBe(true);
    });

    it('should filter by standard', async () => {
      const policies = await governanceService.getPolicies('FINOS');
      expect(policies.length).toBeGreaterThan(0);
      expect(policies.every((p) => p.standard === 'FINOS')).toBe(true);
    });
  });

  describe('getPolicy', () => {
    it('should return a policy by id', async () => {
      const policy = await governanceService.getPolicy('finos-common-cloud-controls');
      expect(policy).not.toBeNull();
      expect(policy?.id).toBe('finos-common-cloud-controls');
    });

    it('should return null for unknown id', async () => {
      const policy = await governanceService.getPolicy('unknown');
      expect(policy).toBeNull();
    });
  });

  describe('checkCompliance', () => {
    it('should return a compliance result', async () => {
      const result = await governanceService.checkCompliance('finos-common-cloud-controls');
      expect(result.policyId).toBe('finos-common-cloud-controls');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.controls)).toBe(true);
    });

    it('should throw for unknown policy', async () => {
      await expect(governanceService.checkCompliance('unknown')).rejects.toThrow();
    });
  });

  describe('assessAllPolicies', () => {
    it('should return compliance results for all policies', async () => {
      const results = await governanceService.assessAllPolicies();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('updateControl', () => {
    it('should update control with evidence', async () => {
      const control = await governanceService.updateControl('finos-common-cloud-controls', 'c3-tagging', {
        status: 'compliant',
        evidence: 'All resources tagged per C3 spec',
        lastAssessed: new Date().toISOString(),
        owner: 'cto@company.com',
      });
      expect(control).not.toBeNull();
      expect(control?.status).toBe('compliant');
    });

    it('should return null for unknown policy', async () => {
      const control = await governanceService.updateControl('unknown', 'c3-tagging', {
        status: 'compliant',
      });
      expect(control).toBeNull();
    });

    it('should return null for unknown control', async () => {
      const control = await governanceService.updateControl('finos-common-cloud-controls', 'unknown-control', {
        status: 'compliant',
      });
      expect(control).toBeNull();
    });
  });
});