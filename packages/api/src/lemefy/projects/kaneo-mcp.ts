import type { LemefyProject, LemefyTask } from '../types';

interface KaneoProject {
  id: string;
  name: string;
  description: string;
  owner: string;
  team: string[];
  tags: string[];
  status: 'active' | 'archived' | 'planning';
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface KaneoTask {
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
}

interface KaneoCreateProjectInput {
  name: string;
  description?: string;
  owner: string;
  team?: string[];
  tags?: string[];
  dueDate?: string;
}

interface KaneoCreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  assignee: string;
  dueDate: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  workflowId?: string;
}

interface KaneoUpdateProjectInput {
  name?: string;
  description?: string;
  status?: 'active' | 'archived' | 'planning';
  tags?: string[];
  team?: string[];
}

interface KaneoUpdateTaskInput {
  title?: string;
  description?: string;
  status?: 'todo' | 'in-progress' | 'review' | 'done' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  dueDate?: string;
  tags?: string[];
  workflowId?: string;
}

class KaneoMCPServer {
  private projects: Map<string, KaneoProject>;
  private tasks: Map<string, KaneoTask>;
  private projectIdCounter: number;
  private taskIdCounter: number;

  constructor() {
    this.projects = new Map();
    this.tasks = new Map();
    this.projectIdCounter = 1;
    this.taskIdCounter = 1;
  }

  createProject(input: KaneoCreateProjectInput): KaneoProject {
    const id = `proj-${this.projectIdCounter++}`;
    const now = new Date().toISOString();

    const project: KaneoProject = {
      id,
      name: input.name,
      description: input.description ?? '',
      owner: input.owner,
      team: input.team ?? [],
      tags: input.tags ?? [],
      status: 'active',
      dueDate: input.dueDate,
      createdAt: now,
      updatedAt: now,
    };

    this.projects.set(id, project);
    return project;
  }

  getProject(id: string): KaneoProject | null {
    return this.projects.get(id) ?? null;
  }

  listProjects(params: {
    owner?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): { projects: KaneoProject[]; total: number } {
    let results = Array.from(this.projects.values());

    if (params.owner) {
      results = results.filter((p) => p.owner === params.owner);
    }
    if (params.status) {
      results = results.filter((p) => p.status === params.status);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      );
    }

    const total = results.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 25;
    const sliced = results.slice(offset, offset + limit);

    return { projects: sliced, total };
  }

  updateProject(id: string, input: KaneoUpdateProjectInput): KaneoProject | null {
    const project = this.projects.get(id);
    if (!project) return null;

    if (input.name !== undefined) project.name = input.name;
    if (input.description !== undefined) project.description = input.description;
    if (input.status !== undefined) project.status = input.status;
    if (input.tags !== undefined) project.tags = input.tags;
    if (input.team !== undefined) project.team = input.team;
    project.updatedAt = new Date().toISOString();

    this.projects.set(id, project);
    return project;
  }

  deleteProject(id: string): boolean {
    const existed = this.projects.has(id);
    if (existed) {
      this.projects.delete(id);
      for (const [taskId, task] of this.tasks) {
        if (task.projectId === id) {
          this.tasks.delete(taskId);
        }
      }
    }
    return existed;
  }

  createTask(input: KaneoCreateTaskInput): KaneoTask {
    const id = `task-${this.taskIdCounter++}`;
    const now = new Date().toISOString();

    const task: KaneoTask = {
      id,
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? '',
      status: 'todo',
      priority: input.priority ?? 'medium',
      assignee: input.assignee,
      dueDate: input.dueDate,
      tags: input.tags ?? [],
      workflowId: input.workflowId,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(id, task);
    return task;
  }

  getTask(id: string): KaneoTask | null {
    return this.tasks.get(id) ?? null;
  }

  listTasks(params: {
    projectId?: string;
    status?: string;
    assignee?: string;
    priority?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): { tasks: KaneoTask[]; total: number } {
    let results = Array.from(this.tasks.values());

    if (params.projectId) {
      results = results.filter((t) => t.projectId === params.projectId);
    }
    if (params.status) {
      results = results.filter((t) => t.status === params.status);
    }
    if (params.assignee) {
      results = results.filter((t) => t.assignee === params.assignee);
    }
    if (params.priority) {
      results = results.filter((t) => t.priority === params.priority);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      results = results.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }

    const total = results.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 25;
    const sliced = results.slice(offset, offset + limit);

    return { tasks: sliced, total };
  }

  updateTask(id: string, input: KaneoUpdateTaskInput): KaneoTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    if (input.title !== undefined) task.title = input.title;
    if (input.description !== undefined) task.description = input.description;
    if (input.status !== undefined) task.status = input.status;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.assignee !== undefined) task.assignee = input.assignee;
    if (input.dueDate !== undefined) task.dueDate = input.dueDate;
    if (input.tags !== undefined) task.tags = input.tags;
    if (input.workflowId !== undefined) task.workflowId = input.workflowId;
    task.updatedAt = new Date().toISOString();

    this.tasks.set(id, task);
    return task;
  }

  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  linkWorkflow(taskId: string, workflowId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    task.workflowId = workflowId;
    task.updatedAt = new Date().toISOString();
    this.tasks.set(taskId, task);
    return true;
  }

  getProjectTasks(projectId: string): KaneoTask[] {
    return Array.from(this.tasks.values())
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }
}

export const kaneoServer = new KaneoMCPServer();

export const kaneoTools = [
  {
    name: 'create_project',
    description: 'Create a new project with name, description, owner, and optional team and tags',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name' },
        description: { type: 'string', description: 'Project description' },
        owner: { type: 'string', description: 'Project owner (user ID)' },
        team: { type: 'array', items: { type: 'string' }, description: 'Team member IDs' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Project tags' },
        dueDate: { type: 'string', description: 'ISO date string for project due date' },
      },
      required: ['name', 'owner'],
    },
  },
  {
    name: 'get_project',
    description: 'Get a project by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_projects',
    description: 'List projects with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Filter by owner' },
        status: { type: 'string', enum: ['active', 'archived', 'planning'], description: 'Filter by status' },
        search: { type: 'string', description: 'Search by name or description' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        offset: { type: 'integer', minimum: 0, default: 0 },
      },
    },
  },
  {
    name: 'update_project',
    description: 'Update a project',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project ID' },
        name: { type: 'string', description: 'New project name' },
        description: { type: 'string', description: 'New description' },
        status: { type: 'string', enum: ['active', 'archived', 'planning'] },
        tags: { type: 'array', items: { type: 'string' } },
        team: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_project',
    description: 'Delete a project and all its tasks',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task within a project',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        assignee: { type: 'string', description: 'Assignee user ID' },
        dueDate: { type: 'string', description: 'Due date as ISO string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
        tags: { type: 'array', items: { type: 'string' } },
        workflowId: { type: 'string', description: 'Optional Prefect workflow ID to link' },
      },
      required: ['projectId', 'title', 'assignee', 'dueDate'],
    },
  },
  {
    name: 'get_task',
    description: 'Get a task by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Filter by project ID' },
        status: { type: 'string', enum: ['todo', 'in-progress', 'review', 'done', 'cancelled'] },
        assignee: { type: 'string', description: 'Filter by assignee' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        search: { type: 'string', description: 'Search by title or description' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        offset: { type: 'integer', minimum: 0, default: 0 },
      },
    },
  },
  {
    name: 'update_task',
    description: 'Update a task',
    inputSchema: {
      type: 'object',
      properties: {
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
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'link_workflow',
    description: 'Link a task to a Prefect workflow',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' },
        workflowId: { type: 'string', description: 'Prefect workflow/flow ID' },
      },
      required: ['taskId', 'workflowId'],
    },
  },
];