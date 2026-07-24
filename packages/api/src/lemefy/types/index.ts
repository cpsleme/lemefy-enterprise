export type FinOpsReport = {
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
};

export type FinOpsCostBreakdown = {
  service: string;
  resourceId: string;
  resourceName: string;
  cost: number;
  unit: string;
  tags: Record<string, string>;
};

export type FinOpsRecommendation = {
  id: string;
  type: 'optimization' | 'alert' | 'rightsizing' | 'reserved' | 'tagging';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  estimatedSavings: number;
  currency: string;
  resourceIds: string[];
  actionUrl?: string;
};

export type DORAMetric = {
  name: 'Lead Time for Changes' | 'Deployment Frequency' | 'Change Failure Rate' | 'Mean Time to Restore';
  value: number;
  unit: string;
  trend: 'improving' | 'stable' | 'declining';
  period: string;
};

export type SPACEMetric = {
  name: 'Velocity' | 'Load' | 'Stability' | 'Time to Productivity' | 'Feedback Loops' | 'Team Happiness';
  value: number;
  unit: string;
  trend: 'improving' | 'stable' | 'declining';
  period: string;
};

export type GovernancePolicy = {
  id: string;
  name: string;
  description: string;
  standard: 'FINOS' | 'NIST' | 'ISO27001' | 'SOC2';
  category: string;
  controls: GovernanceControl[];
  enabled: boolean;
  lastReviewed: string;
};

export type GovernanceControl = {
  id: string;
  name: string;
  description: string;
  status: 'compliant' | 'non-compliant' | 'pending' | 'not-applicable';
  evidence?: string;
  lastAssessed: string;
  owner: string;
};

export type WorkflowExecution = {
  id: string;
  flowName: string;
  flowId: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  trigger: 'manual' | 'schedule' | 'webhook' | 'mcp';
  parameters: Record<string, unknown>;
  logs: WorkflowLogEntry[];
  startTime?: string;
  endTime?: string;
  duration?: number;
  createdAt: string;
};

export type WorkflowLogEntry = {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  step?: string;
};

export type LemefyProject = {
  id: string;
  name: string;
  description: string;
  owner: string;
  team: string[];
  tags: string[];
  status: 'active' | 'archived' | 'planning';
  complianceStatus: 'compliant' | 'non-compliant' | 'pending-review';
  budget?: {
    amount: number;
    currency: string;
    spent: number;
    periodStart: string;
    periodEnd: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type LemefyTask = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee: string;
  dueDate: string;
  tags: string[];
  workflowId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type LemefyKnowledgeArticle = {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  tags: string[];
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type LemefyChatMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  artifacts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
};