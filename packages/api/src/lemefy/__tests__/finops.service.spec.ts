import { finopsService } from '../finops/service';

describe('finopsService', () => {
  beforeEach(() => {
    delete (globalThis as any).__lemefy_cost_data__;
  });

  describe('ingestCostData', () => {
    it('should throw when entries are missing projectId', async () => {
      await expect(
        finopsService.ingestCostData([{ provider: 'aws', timestamp: '2026-01-01T00:00:00Z' } as any]),
      ).rejects.toThrow('projectId and provider are required for cost ingestion');
    });

    it('should throw when entries are missing provider', async () => {
      await expect(
        finopsService.ingestCostData([{ projectId: 'proj-1', timestamp: '2026-01-01T00:00:00Z' } as any]),
      ).rejects.toThrow('projectId and provider are required for cost ingestion');
    });

    it('should store valid entries', async () => {
      await finopsService.ingestCostData([
        {
          projectId: 'proj-1',
          provider: 'aws',
          region: 'us-east-1',
          costCenter: 'engineering',
          service: 'EC2',
          resourceId: 'i-123',
          resourceName: 'prod-server',
          cost: 1500,
          unit: 'USD',
          tags: { team: 'backend' },
          timestamp: '2026-01-01T00:00:00Z',
        },
      ]);

      const report = await finopsService.getCostReport({
        projectId: 'proj-1',
        periodStart: '2026-01-01T00:00:00Z',
        periodEnd: '2026-01-31T23:59:59Z',
      });

      expect(report.totalCost).toBe(1500);
      expect(report.breakdown.length).toBeGreaterThan(0);
    });
  });

  describe('getCostReport', () => {
    it('returns an empty report for unknown project', async () => {
      const report = await finopsService.getCostReport({
        projectId: 'unknown',
        periodStart: '2026-01-01T00:00:00Z',
        periodEnd: '2026-01-31T23:59:59Z',
      });
      expect(report.totalCost).toBe(0);
      expect(report.projectId).toBe('unknown');
    });
  });

  describe('getRecommendations', () => {
    it('returns empty array when no data', async () => {
      const recs = await finopsService.getRecommendations('proj-unknown');
      expect(recs).toEqual([]);
    });
  });
});