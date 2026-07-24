import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpServer as McpServerType } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PrefectMCPServer, PrefectMCPServerOptions } from './prefect-mcp';

interface PrefectMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const prefectMcpTools: PrefectMCPTool[] = [
  {
    name: 'list_flows',
    description: 'List Prefect deployments/flows',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: 'Filter by deployment ID' },
        status: { type: 'string', enum: ['active', 'paused', 'deleted'], description: 'Filter by deployment status' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25, description: 'Max flows to return' },
      },
    },
  },
  {
    name: 'trigger_flow',
    description: 'Trigger a Prefect flow run via deployment',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: 'Deployment ID to trigger' },
        parameters: { type: 'object', description: 'Flow parameters as JSON' },
        wait: { type: 'boolean', default: false, description: 'Wait for run completion' },
      },
      required: ['deploymentId'],
    },
  },
  {
    name: 'list_runs',
    description: 'List Prefect flow runs with filtering',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: 'Filter by deployment ID' },
        status: { type: 'string', enum: ['scheduled', 'pending', 'running', 'completed', 'failed', 'cancelled'], description: 'Filter by run status' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25, description: 'Max runs to return' },
        startTime: { type: 'string', description: 'Filter runs after this ISO timestamp' },
        endTime: { type: 'string', description: 'Filter runs before this ISO timestamp' },
      },
    },
  },
  {
    name: 'get_run',
    description: 'Get details and logs for a specific flow run',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'The run ID to retrieve' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'get_flow',
    description: 'Get details about a specific flow',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'The flow ID to retrieve' },
      },
      required: ['flowId'],
    },
  },
];

export function createPrefectMCPHandler(options: PrefectMCPServerOptions): {
  tools: PrefectMCPTool[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
} {
  const prefectServer = new PrefectMCPServer(options);

  return {
    tools: prefectMcpTools,
    callTool: async (name: string, args: Record<string, unknown>) => {
      return prefectServer.callTool(name, args);
    },
  };
}