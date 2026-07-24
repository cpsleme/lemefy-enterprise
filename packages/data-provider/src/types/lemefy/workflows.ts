export interface LemefyWorkflow {
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
}

export interface WorkflowLogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  step?: string;
}