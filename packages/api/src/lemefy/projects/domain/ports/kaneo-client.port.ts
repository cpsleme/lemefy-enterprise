import type { Project, Task, TaskStatus, TaskPriority } from '../entities';

export interface CreateProjectInput {
  name: string;
  description?: string;
  owner: string;
  team?: string[];
  tags?: string[];
  dueDate?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: Project['status'];
  tags?: string[];
  team?: string[];
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  assignee: string;
  dueDate: string;
  priority?: TaskPriority;
  tags?: string[];
  workflowId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  dueDate?: string;
  tags?: string[];
  workflowId?: string;
}

export interface ListProjectsParams {
  owner?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListTasksParams {
  projectId: string;
  status?: string;
  assignee?: string;
  limit?: number;
  offset?: number;
}

export interface KaneoClient {
  createProject(workspaceId: string, input: CreateProjectInput): Promise<Project>;
  getProject(workspaceId: string, projectId: string): Promise<Project | null>;
  listProjects(workspaceId: string, params?: ListProjectsParams): Promise<{ projects: Project[]; total: number }>;
  updateProject(workspaceId: string, projectId: string, input: UpdateProjectInput): Promise<Project | null>;
  deleteProject(workspaceId: string, projectId: string): Promise<boolean>;

  createTask(workspaceId: string, input: CreateTaskInput): Promise<Task>;
  getTask(workspaceId: string, taskId: string): Promise<Task | null>;
  listTasks(workspaceId: string, params: ListTasksParams): Promise<{ tasks: Task[]; total: number }>;
  updateTask(workspaceId: string, taskId: string, input: UpdateTaskInput): Promise<Task | null>;
  deleteTask(workspaceId: string, taskId: string): Promise<boolean>;
  linkWorkflow(workspaceId: string, taskId: string, workflowId: string): Promise<Task | null>;
}
