import { createPrefectMCPHandler } from './workflows/prefect-mcp-handler';
import { kaneoServer, kaneoTools } from './projects/kaneo-mcp';
import { ragTools, searchKnowledge, addKnowledgeDocument, getDocumentById, listDocuments as listRagDocs, deleteDocument as deleteRagDoc } from './rag/mcp-tools';
import { finopsService } from './finops/service';
import { governanceService } from './governance/service';
import { doraService, spaceService } from './governance/metrics';
import type { LemefyProject, LemefyTask } from './types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';

const prefectHandler = createPrefectMCPHandler({
  apiBaseUrl: process.env.PREFECT_API_URL ?? 'http://localhost:4200',
  apiKey: process.env.PREFECT_API_KEY,
});

const lemefyMcpTools = [
  ...prefectHandler.tools,
  ...kaneoTools,
  ...ragTools,
];

export const lemefyMcpHandler = {
  tools: lemefyMcpTools,

  async callTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case 'list_flows':
      case 'trigger_flow':
      case 'list_runs':
      case 'get_run':
      case 'get_flow':
        return prefectHandler.callTool(name, args);

      case 'create_project':
      case 'get_project':
      case 'list_projects':
      case 'update_project':
      case 'delete_project':
      case 'create_task':
      case 'get_task':
      case 'list_tasks':
      case 'update_task':
      case 'delete_task':
      case 'link_workflow': {
        return handleKaneoTool(name, args);
      }

      case 'search_knowledge':
      case 'add_document':
      case 'get_document':
      case 'list_documents':
      case 'delete_document': {
        return handleRagTool(name, args);
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown LemeFY tool: ${name}` }],
          isError: true,
        };
    }
  },
};

function handleKaneoTool(
  name: string,
  args: Record<string, unknown>,
): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  switch (name) {
    case 'create_project': {
      const input = args as { name: string; owner: string; description?: string; team?: string[]; tags?: string[]; dueDate?: string };
      const project = kaneoServer.createProject(input);
      return { content: [{ type: 'text', text: `Project created: ${project.name} (id: ${project.id})` }] };
    }
    case 'get_project': {
      const { id } = args as { id: string };
      const project = kaneoServer.getProject(id);
      if (!project) return { content: [{ type: 'text', text: `Project not found: ${id}` }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
    }
    case 'list_projects': {
      const { owner, status, search, limit, offset } = args as { owner?: string; status?: string; search?: string; limit?: number; offset?: number };
      const result = kaneoServer.listProjects({ owner, status, search, limit, offset });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'update_project': {
      const { id, ...rest } = args as { id: string; [key: string]: unknown };
      const project = kaneoServer.updateProject(id, rest);
      if (!project) return { content: [{ type: 'text', text: `Project not found: ${id}` }], isError: true };
      return { content: [{ type: 'text', text: `Project updated: ${project.name}` }] };
    }
    case 'delete_project': {
      const { id } = args as { id: string };
      const deleted = kaneoServer.deleteProject(id);
      return { content: [{ type: 'text', text: deleted ? `Project deleted: ${id}` : `Project not found: ${id}` }] };
    }
    case 'create_task': {
      const input = args as { projectId: string; title: string; assignee: string; dueDate: string; description?: string; priority?: string; tags?: string[] };
      const task = kaneoServer.createTask(input);
      return { content: [{ type: 'text', text: `Task created: ${task.title} (id: ${task.id})` }] };
    }
    case 'get_task': {
      const { id } = args as { id: string };
      const task = kaneoServer.getTask(id);
      if (!task) return { content: [{ type: 'text', text: `Task not found: ${id}` }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    }
    case 'list_tasks': {
      const { projectId, status, assignee, search, limit, offset } = args as { projectId?: string; status?: string; assignee?: string; search?: string; limit?: number; offset?: number };
      const result = kaneoServer.listTasks({ projectId, status, assignee, search, limit, offset });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'update_task': {
      const { id, ...rest } = args as { id: string; [key: string]: unknown };
      const task = kaneoServer.updateTask(id, rest);
      if (!task) return { content: [{ type: 'text', text: `Task not found: ${id}` }], isError: true };
      return { content: [{ type: 'text', text: `Task updated: ${task.title}` }] };
    }
    case 'delete_task': {
      const { id } = args as { id: string };
      const deleted = kaneoServer.deleteTask(id);
      return { content: [{ type: 'text', text: deleted ? `Task deleted: ${id}` : `Task not found: ${id}` }] };
    }
    case 'link_workflow': {
      const { taskId, workflowId } = args as { taskId: string; workflowId: string };
      const linked = kaneoServer.linkWorkflow(taskId, workflowId);
      return { content: [{ type: 'text', text: linked ? `Task ${taskId} linked to workflow ${workflowId}` : `Task not found: ${taskId}` }] };
    }
    default:
      return { content: [{ type: 'text', text: `Unknown Kaneo tool: ${name}` }], isError: true };
  }
}

function handleRagTool(
  name: string,
  args: Record<string, unknown>,
): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  switch (name) {
    case 'search_knowledge': {
      const { query, category, source, tags, limit, threshold } = args as { query: string; category?: string; source?: string; tags?: string[]; limit?: number; threshold?: number };
      const results = searchKnowledge({ query, category, source, tags, limit, threshold });
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
    case 'add_document': {
      const doc = args as LemefyKnowledgeArticle;
      addKnowledgeDocument(doc);
      return { content: [{ type: 'text', text: `Document added: ${doc.title}` }] };
    }
    case 'get_document': {
      const { id } = args as { id: string };
      const doc = getDocumentById(id);
      if (!doc) return { content: [{ type: 'text', text: `Document not found: ${id}` }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }] };
    }
    case 'list_documents': {
      const { category, source, limit } = args as { category?: string; source?: string; limit?: number };
      const docs = listRagDocs({ category, source, limit });
      return { content: [{ type: 'text', text: JSON.stringify(docs, null, 2) }] };
    }
    case 'delete_document': {
      const { id } = args as { id: string };
      const deleted = deleteRagDoc(id);
      return { content: [{ type: 'text', text: deleted ? `Document deleted: ${id}` : `Document not found: ${id}` }] };
    }
    default:
      return { content: [{ type: 'text', text: `Unknown RAG tool: ${name}` }], isError: true };
  }
}

export const lemefyService = {
  prefect: {
    handler: prefectHandler,
    tools: prefectHandler.tools,
  },
  kaneo: {
    server: kaneoServer,
    tools: kaneoTools,
  },
  rag: {
    tools: ragTools,
    searchKnowledge,
    addKnowledgeDocument,
    getDocumentById,
    listDocuments: listRagDocs,
    deleteDocument: deleteRagDoc,
  },
  finops: finopsService,
  governance: governanceService,
  dora: doraService,
  space: spaceService,
};