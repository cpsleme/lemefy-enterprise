import { ProjectService } from './application/project-service';
import { KaneoHttpClient } from './infrastructure/kaneo-http-client';
import type { KaneoClient } from './domain/ports/kaneo-client.port';

const kaneoBaseUrl = process.env.KANEO_API_URL ?? 'http://localhost:8001';
const kaneoApiKey = process.env.KANEO_API_KEY;

const kaneoClient = new KaneoHttpClient(kaneoBaseUrl, kaneoApiKey);
const projectService = new ProjectService(kaneoClient, {
  async getOrCreateWorkspace() {
    throw new Error('Workspace creation must be handled by the application layer during user login');
  },
});

export const kaneoServer = {
  async createProject(args: Record<string, unknown>) {
    const { workspaceId, ...input } = args as { workspaceId: string } & Record<string, unknown>;
    return projectService.createProject(workspaceId, input as never);
  },

  async getProject(id: string, args: Record<string, unknown>) {
    const workspaceId = args.workspaceId as string;
    return projectService.getProject(workspaceId, id);
  },

  async listProjects(args: Record<string, unknown>) {
    const workspaceId = args.workspaceId as string;
    const { ...params } = args as Record<string, unknown>;
    return projectService.listProjects(workspaceId, params as never);
  },

  async updateProject(id: string, args: Record<string, unknown>) {
    const workspaceId = args.workspaceId as string;
    const { ...input } = args as Record<string, unknown>;
    return projectService.updateProject(workspaceId, id, input as never);
  },

  async deleteProject(id: string, args: Record<string, unknown>) {
    const workspaceId = args.workspaceId as string;
    return projectService.deleteProject(workspaceId, id);
  },

  async createTask(args: Record<string, unknown>) {
    const { workspaceId, ...input } = args as { workspaceId: string } & Record<string, unknown>;
    return projectService.createTask(workspaceId, input as never);
  },

  async getTask(id: string, args: Record<string, unknown>) {
    const workspaceId = args.workspaceId as string;
    return projectService.getTask(workspaceId, id);
  },

  async listTasks(args: Record<string, unknown>) {
    const workspaceId = args.workspaceId as string;
    const { ...params } = args as Record<string, unknown>;
    return projectService.listTasks(workspaceId, params as never);
  },

  async updateTask(id: string, args: Record<string, unknown>) {
    const workspaceId = args.workspaceId as string;
    const { ...input } = args as Record<string, unknown>;
    return projectService.updateTask(workspaceId, id, input as never);
  },

  async deleteTask(id: string, args: Record<string, unknown>) {
    const workspaceId = args.workspaceId as string;
    return projectService.deleteTask(workspaceId, id);
  },

  async linkWorkflow(taskId: string, workflowId: string, args: Record<string, unknown>) {
    const workspaceId = args.workspaceId as string;
    return projectService.linkWorkflow(workspaceId, taskId, workflowId);
  },
};

export const kaneoTools = [
  {
    name: 'create_project',
    description: 'Create a new project with name, description, owner, and optional team and tags',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Kaneo workspace ID' },
        name: { type: 'string', description: 'Project name' },
        description: { type: 'string', description: 'Project description' },
        owner: { type: 'string', description: 'Project owner (user ID)' },
        team: { type: 'array', items: { type: 'string' }, description: 'Team member IDs' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Project tags' },
        dueDate: { type: 'string', description: 'ISO date string for project due date' },
      },
      required: ['workspaceId', 'name', 'owner'],
    },
  },
  {
    name: 'get_project',
    description: 'Get a project by ID',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Kaneo workspace ID' },
        id: { type: 'string', description: 'Project ID' },
      },
      required: ['workspaceId', 'id'],
    },
  },
  {
    name: 'list_projects',
    description: 'List projects with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Kaneo workspace ID' },
        owner: { type: 'string', description: 'Filter by owner' },
        status: { type: 'string', enum: ['active', 'archived', 'planning'], description: 'Filter by status' },
        search: { type: 'string', description: 'Search by name or description' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        offset: { type: 'integer', minimum: 0, default: 0 },
      },
      required: ['workspaceId'],
    },
  },
  {
    name: 'update_project',
    description: 'Update a project',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Kaneo workspace ID' },
        id: { type: 'string', description: 'Project ID' },
        name: { type: 'string', description: 'New project name' },
        description: { type: 'string', description: 'New description' },
        status: { type: 'string', enum: ['active', 'archived', 'planning'] },
        tags: { type: 'array', items: { type: 'string' } },
        team: { type: 'array', items: { type: 'string' } },
      },
      required: ['workspaceId', 'id'],
    },
  },
  {
    name: 'delete_project',
    description: 'Delete a project and all its tasks',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Kaneo workspace ID' },
        id: { type: 'string', description: 'Project ID' },
      },
      required: ['workspaceId', 'id'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task within a project',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Kaneo workspace ID' },
        projectId: { type: 'string', description: 'Project ID' },
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        assignee: { type: 'string', description: 'Assignee user ID' },
        dueDate: { type: 'string', description: 'Due date as ISO string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
        tags: { type: 'array', items: { type: 'string' } },
        workflowId: { type: 'string', description: 'Prefect workflow ID to link' },
      },
      required: ['workspaceId', 'projectId', 'title', 'assignee', 'dueDate'],
    },
  },
  {
    name: 'get_task',
    description: 'Get a task by ID',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Kaneo workspace ID' },
        id: { type: 'string', description: 'Task ID' },
      },
      required: ['workspaceId', 'id'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Kaneo workspace ID' },
        projectId: { type: 'string', description: 'Filter by project ID' },
        status: { type: 'string', enum: ['todo', 'in-progress', 'review', 'done', 'cancelled'] },
        assignee: { type: 'string', description: 'Filter by assignee' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        search: { type: 'string', description: 'Search by title or description' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        offset: { type: 'integer', minimum: 0, default: 0 },
      },
      required: ['workspaceId'],
    },
  },
  {
    name: 'update_task',
    description: 'Update a task',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Kaneo workspace ID' },
        id: { type: 'string', description: 'Task ID' },
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        status: { type: 'string', enum: ['todo', 'in-progress', 'review', 'done', 'cancelled'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        assignee: { type: 'string', description: 'Assignee user ID' },
        dueDate: { type: 'string', description: 'Due date as ISO string' },
        tags: { type: 'array', items: { type: 'string' } },
        workflowId: { type: 'string', description: 'Prefect workflow ID' },
      },
      required: ['workspaceId', 'id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Kaneo workspace ID' },
        id: { type: 'string', description: 'Task ID' },
      },
      required: ['workspaceId', 'id'],
    },
  },
  {
    name: 'link_workflow',
    description: 'Link a task to a Prefect workflow',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Kaneo workspace ID' },
        taskId: { type: 'string', description: 'Task ID' },
        workflowId: { type: 'string', description: 'Prefect workflow/flow ID' },
      },
      required: ['workspaceId', 'taskId', 'workflowId'],
    },
  },
];
