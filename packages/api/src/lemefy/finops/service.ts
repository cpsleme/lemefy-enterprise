import type {
  FinOpsReport,
  FinOpsRecommendation,
  FinOpsCostBreakdown,
} from '../types';

interface CostQueryParams {
  projectId?: string;
  team?: string;
  provider?: string;
  periodStart: string;
  periodEnd: string;
  currency?: string;
}

interface CostIngestionEntry {
  projectId: string;
  provider: string;
  region: string;
  costCenter: string;
  service: string;
  resourceId: string;
  resourceName: string;
  cost: number;
  unit: string;
  tags: Record<string, string>;
  timestamp: string;
}

const DEFAULT_CURRENCY = 'USD';

function parseCost(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function buildBreakdown(entries: CostIngestionEntry[]): FinOpsCostBreakdown[] {
  const byService = new Map<string, FinOpsCostBreakdown>();
  for (const entry of entries) {
    const existing = byService.get(entry.service);
    if (existing) {
      existing.cost += entry.cost;
    } else {
      byService.set(entry.service, {
        service: entry.service,
        resourceId: entry.resourceId,
        resourceName: entry.resourceName,
        cost: entry.cost,
        unit: entry.unit,
        tags: entry.tags,
      });
    }
  }
  return Array.from(byService.values());
}

function detectAnomalies(entries: CostIngestionEntry[]): FinOpsRecommendation[] {
  const recommendations: FinOpsRecommendation[] = [];
  const serviceCosts = new Map<string, number>();

  for (const entry of entries) {
    const current = serviceCosts.get(entry.service) ?? 0;
    serviceCosts.set(entry.service, current + entry.cost);
  }

  const totalCost = Array.from(serviceCosts.values()).reduce(
    (sum, cost) => sum + cost,
    0,
  );

  for (const [service, cost] of serviceCosts) {
    if (totalCost > 0 && cost / totalCost > 0.4) {
      recommendations.push({
        id: `rec-${service}-${Date.now()}`,
        type: 'optimization',
        severity: cost / totalCost > 0.6 ? 'critical' : 'warning',
        title: `High cost concentration in ${service}`,
        description: `${service} accounts for ${((cost / totalCost) * 100).toFixed(1)}% of total spend. Consider rightsizing or reserved instances.`,
        estimatedSavings: cost * 0.2,
        currency: DEFAULT_CURRENCY,
        resourceIds: entries
          .filter((e) => e.service === service)
          .map((e) => e.resourceId),
      });
    }
  }

  for (const entry of entries) {
    if (entry.cost > 10000 && entry.unit === 'USD') {
      recommendations.push({
        id: `rec-expensive-${entry.resourceId}`,
        type: 'rightsizing',
        severity: 'warning',
        title: `Expensive resource: ${entry.resourceName}`,
        description: `Resource ${entry.resourceName} ($${entry.cost}) may be over-provisioned.`,
        estimatedSavings: entry.cost * 0.3,
        currency: DEFAULT_CURRENCY,
        resourceIds: [entry.resourceId],
      });
    }
  }

  return recommendations;
}

function generateReport(
  entries: CostIngestionEntry[],
  projectId: string,
  projectName: string,
  periodStart: string,
  periodEnd: string,
): FinOpsReport {
  const breakdown = buildBreakdown(entries);
  const totalCost = breakdown.reduce((sum, b) => sum + b.cost, 0);
  const recommendations = detectAnomalies(entries);

  return {
    id: `report-${projectId}-${periodStart}-${periodEnd}`,
    projectId,
    projectName,
    provider: entries[0]?.provider ?? 'unknown',
    region: entries[0]?.region ?? 'unknown',
    costCenter: entries[0]?.costCenter ?? 'default',
    currency: DEFAULT_CURRENCY,
    totalCost,
    breakdown,
    periodStart,
    periodEnd,
    generatedAt: new Date().toISOString(),
    recommendations,
  };
}

export const finopsService = {
  async ingestCostData(entries: CostIngestionEntry[]): Promise<void> {
    for (const entry of entries) {
      if (!entry.projectId || !entry.provider) {
        throw new Error('projectId and provider are required for cost ingestion');
      }
    }
    const costData = (globalThis as Record<string, unknown>).__lemefy_cost_data__ as CostIngestionEntry[] ?? [];
    (globalThis as Record<string, unknown>).__lemefy_cost_data__ = [...costData, ...entries];
  },

  async getCostReport(params: CostQueryParams): Promise<FinOpsReport> {
    const allData = (globalThis.__lemefy_cost_data__ ?? []) as CostIngestionEntry[];
    const filtered = allData.filter((entry) => {
      if (params.projectId && entry.projectId !== params.projectId) return false;
      if (params.team && entry.tags.team !== params.team) return false;
      if (params.provider && entry.provider !== params.provider) return false;
      if (entry.timestamp < params.periodStart || entry.timestamp > params.periodEnd)
        return false;
      return true;
    });

    if (filtered.length === 0) {
      return generateReport([], '', params.projectId ?? 'unknown', params.periodStart, params.periodEnd);
    }

    const projectName = filtered[0].tags.projectName ?? params.projectId ?? 'unknown';
    return generateReport(
      filtered,
      params.projectId ?? filtered[0].projectId,
      projectName,
      params.periodStart,
      params.periodEnd,
    );
  },

  async getRecommendations(projectId: string): Promise<FinOpsRecommendation[]> {
    const report = await this.getCostReport({
      projectId,
      periodStart: '2000-01-01T00:00:00Z',
      periodEnd: new Date().toISOString(),
    });
    return report.recommendations;
  },

  async getCostByService(
    projectId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<FinOpsCostBreakdown[]> {
    const report = await this.getCostReport({
      projectId,
      periodStart,
      periodEnd,
    });
    return report.breakdown;
  },
};