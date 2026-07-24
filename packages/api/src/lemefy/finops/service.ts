import axios from 'axios';
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

interface ProviderCredentials {
  aws?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string };
  azure?: { tenantId: string; clientId: string; clientSecret: string; subscriptionId: string };
  gcp?: { projectId: string; credentials: Record<string, unknown> };
}

const DEFAULT_CURRENCY = 'USD';
const COST_STORE_KEY = '__lemefy_cost_data__';

function parseCost(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getCostStore(): CostIngestionEntry[] {
  return ((globalThis as Record<string, unknown>)[COST_STORE_KEY] as CostIngestionEntry[]) ?? [];
}

function setCostStore(data: CostIngestionEntry[]): void {
  (globalThis as Record<string, unknown>)[COST_STORE_KEY] = data;
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

interface AwsCostResult {
  service: string;
  resourceId: string;
  resourceName: string;
  cost: number;
  region: string;
  usageStartDate: string;
  usageEndDate: string;
}

interface AzureCostResult {
  service: string;
  resourceId: string;
  resourceName: string;
  cost: number;
  region: string;
  usageStartDate: string;
  usageEndDate: string;
}

interface GcpCostResult {
  service: string;
  resourceId: string;
  resourceName: string;
  cost: number;
  region: string;
  usageStartDate: string;
  usageEndDate: string;
}

function normalizeAwsResults(
  results: AwsCostResult[],
  projectId: string,
  costCenter: string,
  tags: Record<string, string>,
): CostIngestionEntry[] {
  return results.map((r) => ({
    projectId,
    provider: 'aws',
    region: r.region,
    costCenter,
    service: r.service,
    resourceId: r.resourceId,
    resourceName: r.resourceName,
    cost: r.cost,
    unit: 'USD',
    tags,
    timestamp: r.usageStartDate,
  }));
}

function normalizeAzureResults(
  results: AzureCostResult[],
  projectId: string,
  costCenter: string,
  tags: Record<string, string>,
): CostIngestionEntry[] {
  return results.map((r) => ({
    projectId,
    provider: 'azure',
    region: r.region,
    costCenter,
    service: r.service,
    resourceId: r.resourceId,
    resourceName: r.resourceName,
    cost: r.cost,
    unit: 'USD',
    tags,
    timestamp: r.usageStartDate,
  }));
}

function normalizeGcpResults(
  results: GcpCostResult[],
  projectId: string,
  costCenter: string,
  tags: Record<string, string>,
): CostIngestionEntry[] {
  return results.map((r) => ({
    projectId,
    provider: 'gcp',
    region: r.region,
    costCenter,
    service: r.service,
    resourceId: r.resourceId,
    resourceName: r.resourceName,
    cost: r.cost,
    unit: 'USD',
    tags,
    timestamp: r.usageStartDate,
  }));
}

function buildQueryFilter(
  granularity: 'DAILY' | 'MONTHLY',
  periodStart: string,
  periodEnd: string,
): Record<string, unknown> {
  return {
    TimePeriod: {
      Start: periodStart.split('T')[0] ?? periodStart,
      End: periodEnd.split('T')[0] ?? periodEnd,
    },
    Granularity: granularity,
    Metrics: ['UnblendedCost'],
    GroupBy: [
      { Type: 'DIMENSION', Key: 'SERVICE' },
      { Type: 'DIMENSION', Key: 'REGION' },
    ],
  };
}

interface AwsCostResponse {
  ResultsByTime: Array<{
    TimePeriod: { Start: string; End: string };
    Groups: Array<{
      Keys: string[];
      Metrics: { UnblendedCost: { Amount: string } };
    }>;
  }>;
}

interface AzureCostResponseItem {
  serviceName?: string;
  service?: string;
  resourceId?: string;
  id?: string;
  resourceName?: string;
  cost?: unknown;
  totalCost?: unknown;
  region?: string;
  location?: string;
  usageStart?: string;
  usageEnd?: string;
  date?: string;
}

interface GcpCostResponse {
  rows?: Array<{
    cost?: unknown;
    service?: { description?: string };
    resource?: { name?: string };
    location?: { location?: string };
    usageStartTime?: string;
    usageEndTime?: string;
    startTime?: string;
    endTime?: string;
  }>;
  billingData?: Array<{
    cost?: unknown;
    service?: { description?: string };
    resource?: { name?: string };
    location?: { location?: string };
    usageStartTime?: string;
    usageEndTime?: string;
    startTime?: string;
    endTime?: string;
  }>;
}

function normalizeAwsResponse(data: unknown): AwsCostResult[] {
  const results: AwsCostResult[] = [];
  const response = data as AwsCostResponse;
  const rows = response.ResultsByTime ?? [];

  for (const row of rows) {
    const groups = row.Groups ?? [];
    const timeStart = row.TimePeriod?.Start ?? '';
    const timeEnd = row.TimePeriod?.End ?? '';

    for (const group of groups) {
      const metrics = group.Metrics?.UnblendedCost ?? { Amount: '0' };
      const amount = parseCost(metrics.Amount);
      const keys = (group.Keys ?? []).filter(Boolean);
      const service = keys[0] ?? 'Unknown';
      const region = keys[1] ?? 'unknown';

      results.push({
        service,
        resourceId: `${service}-${region}-${timeStart}`,
        resourceName: service,
        cost: amount,
        region,
        usageStartDate: timeStart,
        usageEndDate: timeEnd,
      });
    }
  }

  return results;
}

function normalizeAzureResponse(data: unknown): AzureCostResult[] {
  const results: AzureCostResult[] = [];
  const items = (data as AzureCostResponseItem[]) ?? [];

  for (const item of items) {
    const cost = parseCost(item.cost ?? item.totalCost ?? 0);
    results.push({
      service: String(item.serviceName ?? item.service ?? 'Unknown'),
      resourceId: String(item.resourceId ?? item.id ?? `${item.serviceName ?? 'azure'}-${Date.now()}`),
      resourceName: String(item.resourceName ?? item.serviceName ?? 'Unknown'),
      cost,
      region: String(item.region ?? item.location ?? 'unknown'),
      usageStartDate: String(item.usageStart ?? item.date ?? ''),
      usageEndDate: String(item.usageEnd ?? item.date ?? ''),
    });
  }

  return results;
}

function normalizeGcpResponse(data: unknown): GcpCostResult[] {
  const results: GcpCostResult[] = [];
  const response = data as GcpCostResponse;
  const rows = response.rows ?? response.billingData ?? [];

  for (const row of rows) {
    const cost = parseCost(row.cost ?? 0);
    results.push({
      service: String(row.service?.description ?? row.service ?? 'Unknown'),
      resourceId: String(row.resource?.name ?? `${row.service?.description ?? 'gcp'}-${Date.now()}`),
      resourceName: String(row.resource?.name ?? 'Unknown'),
      cost,
      region: String(row.location?.location ?? 'unknown'),
      usageStartDate: String(row.usageStartTime ?? row.startTime ?? ''),
      usageEndDate: String(row.usageEndTime ?? row.endTime ?? ''),
    });
  }

  return results;
}

async function fetchAwsCosts(
  credentials: ProviderCredentials['aws'],
  periodStart: string,
  periodEnd: string,
  granularity: 'DAILY' | 'MONTHLY' = 'DAILY',
): Promise<AwsCostResult[]> {
  if (!credentials) {
    return [];
  }

  const query = buildQueryFilter(granularity, periodStart, periodEnd);
  const response = await axios.post(
    'https://ce.us-east-1.amazonaws.com/',
    {
      ...query,
      ...credentials,
    },
    {
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSPriceListService.GetProducts',
      },
      timeout: 60_000,
    },
  );

  return normalizeAwsResponse(response.data ?? {});
}

async function fetchAzureCosts(
  credentials: ProviderCredentials['azure'],
  periodStart: string,
  periodEnd: string,
): Promise<AzureCostResult[]> {
  if (!credentials) {
    return [];
  }

  const { tenantId, clientId, clientSecret, subscriptionId } = credentials;
  const tokenResponse = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://management.azure.com/.default',
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30_000,
    },
  );

  const accessToken = tokenResponse.data.access_token;
  const startDate = periodStart.split('T')[0] ?? periodStart;
  const endDate = periodEnd.split('T')[0] ?? periodEnd;

  const response = await axios.get(
    `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query`,
    {
      params: {
        '$filter': `properties/UsageDate ge ${startDate} and properties/UsageDate le ${endDate}`,
        '$api-version': '2023-11-01',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    },
  );

  return normalizeAzureResponse(response.data?.value ?? response.data?.properties?.rows ?? []);
}

async function fetchGcpCosts(
  credentials: ProviderCredentials['gcp'],
  periodStart: string,
  periodEnd: string,
): Promise<GcpCostResult[]> {
  if (!credentials) {
    return [];
  }

  const startDate = periodStart.split('T')[0] ?? periodStart;
  const endDate = periodEnd.split('T')[0] ?? periodEnd;

  const response = await axios.post(
    `https://cloudbilling.googleapis.com/v1/projects/${credentials.projectId}:queryBillingData`,
    {
      query: {
        filter: {
          dateRange: {
            startDate,
            endDate,
          },
        },
        groupBy: [{ key: 'service', type: 'SERVICE' }, { key: 'region', type: 'REGION' }],
      },
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60_000,
    },
  );

  return normalizeGcpResponse(response.data ?? {});
}

export const finopsService = {
  async ingestCostData(entries: CostIngestionEntry[]): Promise<void> {
    for (const entry of entries) {
      if (!entry.projectId || !entry.provider) {
        throw new Error('projectId and provider are required for cost ingestion');
      }
    }
    const costData = getCostStore();
    setCostStore([...costData, ...entries]);
  },

  async ingestProviderCosts(
    provider: 'aws' | 'azure' | 'gcp',
    credentials: ProviderCredentials['aws'] | ProviderCredentials['azure'] | ProviderCredentials['gcp'],
    projectId: string,
    costCenter: string,
    periodStart: string,
    periodEnd: string,
    granularity: 'DAILY' | 'MONTHLY' = 'DAILY',
  ): Promise<CostIngestionEntry[]> {
    let results: AwsCostResult[] | AzureCostResult[] | GcpCostResult[] = [];

    switch (provider) {
      case 'aws':
        results = await fetchAwsCosts(credentials as ProviderCredentials['aws'], periodStart, periodEnd, granularity);
        break;
      case 'azure':
        results = await fetchAzureCosts(credentials as ProviderCredentials['azure'], periodStart, periodEnd);
        break;
      case 'gcp':
        results = await fetchGcpCosts(credentials as ProviderCredentials['gcp'], periodStart, periodEnd);
        break;
    }

    switch (provider) {
      case 'aws':
        return normalizeAwsResults(results as AwsCostResult[], projectId, costCenter, { provider: 'aws' });
      case 'azure':
        return normalizeAzureResults(results as AzureCostResult[], projectId, costCenter, { provider: 'azure' });
      case 'gcp':
        return normalizeGcpResults(results as GcpCostResult[], projectId, costCenter, { provider: 'gcp' });
    }
  },

  async getCostReport(params: CostQueryParams): Promise<FinOpsReport> {
    const allData = getCostStore();
    const filtered = allData.filter((entry) => {
      if (params.projectId && entry.projectId !== params.projectId) return false;
      if (params.team && entry.tags.team !== params.team) return false;
      if (params.provider && entry.provider !== params.provider) return false;
      if (entry.timestamp < params.periodStart || entry.timestamp > params.periodEnd)
        return false;
      return true;
    });

    if (filtered.length === 0) {
      return generateReport([], params.projectId ?? 'unknown', params.projectId ?? 'unknown', params.periodStart, params.periodEnd);
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