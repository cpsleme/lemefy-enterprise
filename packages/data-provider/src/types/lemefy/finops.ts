export interface LemefyFinOpsReport {
  id: string;
  projectId: string;
  projectName: string;
  provider: string;
  region: string;
  costCenter: string;
  currency: string;
  totalCost: number;
  breakdown: FinOpsCostBreakdown[];
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  recommendations: FinOpsRecommendation[];
}

export interface FinOpsCostBreakdown {
  service: string;
  resourceId: string;
  resourceName: string;
  cost: number;
  unit: string;
  tags: Record<string, string>;
}

export interface FinOpsRecommendation {
  id: string;
  type: 'optimization' | 'alert' | 'rightsizing' | 'reserved' | 'tagging';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  estimatedSavings: number;
  currency: string;
  resourceIds: string[];
  actionUrl?: string;
}