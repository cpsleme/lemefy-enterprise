import {
  McpServer,
  type Tool,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WorkflowExecution, WorkflowLogEntry } from '../types';

interface PrefectFlow {
  id: string;
  name: string;
  description?: string;
  schedule?: string;
  parameters: Record<string, unknown>;
  lastRunStatus?: string;
  lastRunAt?: string;
}

interface PrefectDeployment {
  id: string;
  name: string;
  flowId: string;
  flowName: string;
  version: string;
  status: 'active' | 'paused' | 'deleted';
  createdAt: string;
}

interface PrefectRun {
  id: string;
  flowRunId: string;
  deploymentId: string;
  status: 'scheduled' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  parameters: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
  duration?: number;
  logs: WorkflowLogEntry[];
}

function createWorkflowExecutions(
  runs: PrefectRun[],
): WorkflowExecution[] {
  return runs.map((run) => ({
    id: run.id,
    flowName: run.deploymentId,
    flowId: run.deploymentId,
    status: run.status as WorkflowExecution['status'],
    trigger: 'manual',
    parameters: run.parameters,
    logs: run.logs,
    startTime: run.startTime,
    endTime: run.endTime,
    duration: run.duration,
    createdAt: run.startTime ?? new Date().toISOString(),
  }));
}

const listFlowsSchema = {
  deploymentId: z.string().optional().describe('Filter by deployment ID'),
  status: z.enum(['active', 'paused', 'deleted']).optional().describe('Filter by deployment status'),
  limit: z.number().int().min(1).max(100).default(25).describe('Maximum number of flows to return'),
};

const triggerFlowSchema = {
  deploymentId: z.string().describe('Deployment ID to trigger'),
  parameters: z.record(z.unknown()).optional().describe('Flow parameters as JSON'),
  wait: z.boolean().default(false).describe('Wait for run completion'),
};

const listRunsSchema = {
  deploymentId: z.string().optional().describe('Filter by deployment ID'),
  status: z.enum(['scheduled', 'pending', 'running', 'completed', 'failed', 'cancelled']).optional().describe('Filter by run status'),
  limit: z.number().int().min(1).max(100).default(25).describe('Maximum number of runs to return'),
  startTime: z.string().optional().describe('Filter runs after this ISO timestamp'),
  endTime: z.string().optional().describe('Filter runs before this ISO timestamp'),
};

const getRunSchema = {
  runId: z.string().describe('The run ID to retrieve'),
};

const getFlowSchema = {
  flowId: z.string().describe('The flow ID to retrieve'),
};

export type PrefectMCPTools = {
  list_flows: typeof listFlowsSchema;
  trigger_flow: typeof triggerFlowSchema;
  list_runs: typeof listRunsSchema;
  get_run: typeof getRunSchema;
  get_flow: typeof getFlowSchema;
};

export interface PrefectMCPServerOptions {
  apiBaseUrl: string;
  apiKey?: string;
  defaultHeaders?: Record<string, string>;
}

export interface PrefectMCPResult {
  tools: Tool[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<CallToolResult>;
  listResources?: () => Promise<unknown>;
  readResource?: (uri: string) => Promise<unknown>;
}

class PrefectMCPServer {
  private options: PrefectMCPServerOptions;
  private flows: Map<string, PrefectFlow>;
  private deployments: Map<string, PrefectDeployment>;
  private runs: Map<string, PrefectRun>;

  constructor(options: PrefectMCPServerOptions) {
    this.options = options;
    this.flows = new Map();
    this.deployments = new Map();
    this.runs = new Map();
  }

  getTools(): Tool[] {
    return [
      {
        name: 'list_flows',
        description: 'List Prefect deployments/flows',
        inputSchema: listFlowsSchema as unknown as Record<string, unknown>,
      },
      {
        name: 'trigger_flow',
        description: 'Trigger a Prefect flow run via deployment',
        inputSchema: triggerFlowSchema as unknown as Record<string, unknown>,
      },
      {
        name: 'list_runs',
        description: 'List Prefect flow runs with filtering',
        inputSchema: listRunsSchema as unknown as Record<string, unknown>,
      },
      {
        name: 'get_run',
        description: 'Get details and logs for a specific flow run',
        inputSchema: getRunSchema as unknown as Record<string, unknown>,
      },
      {
        name: 'get_flow',
        description: 'Get details about a specific flow',
        inputSchema: getFlowSchema as unknown as Record<string, unknown>,
      },
    ];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    switch (name) {
      case 'list_flows':
        return this.handleListFlows(args);
      case 'trigger_flow':
        return this.handleTriggerFlow(args);
      case 'list_runs':
        return this.handleListRuns(args);
      case 'get_run':
        return this.handleGetRun(args);
      case 'get_flow':
        return this.handleGetFlow(args);
      default:
        return {
          content: [
            { type: 'text', text: `Unknown tool: ${name}` },
          ],
          isError: true,
        };
    }
  }

  private handleListFlows(args: Record<string, unknown>): CallToolResult {
    const { deploymentId, status, limit } = args as {
      deploymentId?: string;
      status?: string;
      limit?: number;
    };

    let deployments = Array.from(this.deployments.values());

    if (deploymentId) {
      deployments = deployments.filter((d) => d.id === deploymentId);
    }
    if (status) {
      deployments = deployments.filter((d) => d.status === status);
    }

    const limited = deployments.slice(0, limit ?? 25);

    const text = limited
      .map(
        (d) =>
          `- **${d.name}** (id: ${d.id}, flow: ${d.flowName}, status: ${d.status}, version: ${d.version})`,
      )
      .join('\n') || 'No deployments found.';

    return {
      content: [{ type: 'text', text: `Found ${limited.length} deployment(s):\n${text}` }],
    };
  }

  private handleTriggerFlow(args: Record<string, unknown>): CallToolResult {
    const { deploymentId, parameters, wait } = args as {
      deploymentId: string;
      parameters?: Record<string, unknown>;
      wait?: boolean;
    };

    if (!deploymentId) {
      return {
        content: [{ type: 'text', text: 'deploymentId is required' }],
        isError: true,
      };
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const run: PrefectRun = {
      id: runId,
      flowRunId: runId,
      deploymentId,
      status: wait ? 'running' : 'scheduled',
      parameters: parameters ?? {},
      startTime: now,
      logs: [
        {
          timestamp: now,
          level: 'info',
          message: `Flow run triggered for deployment ${deploymentId}`,
          step: 'trigger',
        },
      ],
    };

    this.runs.set(runId, run);

    if (wait) {
      const completedRun = this.simulateRunCompletion(run);
      return {
        content: [
          {
            type: 'text',
            text: `Flow run completed:\n- Run ID: ${completedRun.id}\n- Status: ${completedRun.status}\n- Duration: ${completedRun.duration}ms`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Flow run triggered successfully.\n- Run ID: ${runId}\n- Deployment: ${deploymentId}\n- Status: ${run.status}`,
        },
      ],
    };
  }

  private handleListRuns(args: Record<string, unknown>): CallToolResult {
    const { deploymentId, status, limit, startTime, endTime } = args as {
      deploymentId?: string;
      status?: string;
      limit?: number;
      startTime?: string;
      endTime?: string;
    };

    let runs = Array.from(this.runs.values());

    if (deploymentId) {
      runs = runs.filter((r) => r.deploymentId === deploymentId);
    }
    if (status) {
      runs = runs.filter((r) => r.status === status);
    }
    if (startTime) {
      runs = runs.filter((r) => r.startTime && r.startTime >= startTime);
    }
    if (endTime) {
      runs = runs.filter((r) => r.startTime && r.startTime <= endTime);
    }

    runs.sort((a, b) => (b.startTime ?? '').localeCompare(a.startTime ?? ''));
    const limited = runs.slice(0, limit ?? 25);

    const text = limited
      .map(
        (r) =>
          `- **${r.id}** - ${r.status} (${r.deploymentId}) - started: ${r.startTime ?? 'N/A'}`,
      )
      .join('\n') || 'No runs found.';

    return {
      content: [{ type: 'text', text: `Found ${limited.length} run(s):\n${text}` }],
    };
  }

  private handleGetRun(args: Record<string, unknown>): CallToolResult {
    const { runId } = args as { runId: string };

    const run = this.runs.get(runId);
    if (!run) {
      return {
        content: [{ type: 'text', text: `Run not found: ${runId}` }],
        isError: true,
      };
    }

    const logText = run.logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Run ${run.id}:\n- Status: ${run.status}\n- Deployment: ${run.deploymentId}\n- Started: ${run.startTime ?? 'N/A'}\n- Ended: ${run.endTime ?? 'N/A'}\n- Duration: ${run.duration ?? 'N/A'}ms\n\nLogs:\n${logText}`,
        },
      ],
    };
  }

  private handleGetFlow(args: Record<string, unknown>): CallToolResult {
    const { flowId } = args as { flowId: string };

    const deployment = this.deployments.get(flowId);
    if (!deployment) {
      return {
        content: [{ type: 'text', text: `Flow not found: ${flowId}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Flow: ${deployment.flowName}\n- Deployment ID: ${deployment.id}\n- Status: ${deployment.status}\n- Version: ${deployment.version}\n- Created: ${deployment.createdAt}`,
        },
      ],
    };
  }

  private simulateRunCompletion(run: PrefectRun): PrefectRun {
    const completionTime = new Date(Date.now() + 5000).toISOString();
    const duration = Math.floor(Math.random() * 10000) + 1000;

    run.status = 'completed';
    run.endTime = completionTime;
    run.duration = duration;
    run.logs.push({
      timestamp: completionTime,
      level: 'info',
      message: 'Flow run completed successfully',
      step: 'complete',
    });

    this.runs.set(run.id, run);
    return run;
  }

  registerDeployment(deployment: PrefectDeployment): void {
    this.deployments.set(deployment.id, deployment);
  }

  registerFlow(flow: PrefectFlow): void {
    this.flows.set(flow.id, flow);
  }

  addRun(run: PrefectRun): void {
    this.runs.set(run.id, run);
  }
}

export function createPrefectMCPServer(
  options: PrefectMCPServerOptions,
): PrefectMCPServer {
  const server = new PrefectMCPServer(options);
  return server;
}