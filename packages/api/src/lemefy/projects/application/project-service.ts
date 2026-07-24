import type { Project, Task, ProjectStatus, TaskStatus, TaskPriority } from '../domain/entities';
import type {
  KaneoClient,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  ListProjectsParams,
  ListTasksParams,
} from '../domain/ports/kaneo-client.port';
import type { WorkspaceManager } from '../domain/ports/workspace-manager.port';

export class ProjectService {
  constructor(
    private readonly kaneoClient: KaneoClient,
    private readonly workspaceManager: WorkspaceManager,
  ) {}

  async ensureWorkspace(userId: string, userName: string): Promise<string> {
    return this.workspaceManager.getOrCreateWorkspace(userId, userName);
  }

  async createProject(workspaceId: string, input: CreateProjectInput): Promise<Project> {
    return this.kaneoClient.createProject(workspaceId, input);
  }

  async getProject(workspaceId: string, projectId: string): Promise<Project | null> {
    return this.kaneoClient.getProject(workspaceId, projectId);
  }

  async listProjects(workspaceId: string, params?: ListProjectsParams): Promise<{ projects: Project[]; total: number }> {
    return this.kaneoClient.listProjects(workspaceId, params);
  }

  async updateProject(workspaceId: string, projectId: string, input: UpdateProjectInput): Promise<Project | null> {
    return this.kaneoClient.updateProject(workspaceId, projectId, input);
  }

  async deleteProject(workspaceId: string, projectId: string): Promise<boolean> {
    return this.kaneoClient.deleteProject(workspaceId, projectId);
  }

  async createTask(workspaceId: string, input: CreateTaskInput): Promise<Task> {
    return this.kaneoClient.createTask(workspaceId, input);
  }

  async getTask(workspaceId: string, taskId: string): Promise<Task | null> {
    return this.kaneoClient.getTask(workspaceId, taskId);
  }

  async listTasks(workspaceId: string, params: ListTasksParams): Promise<{ tasks: Task[]; total: number }> {
    return this.kaneoClient.listTasks(workspaceId, params);
  }

  async updateTask(workspaceId: string, taskId: string, input: UpdateTaskInput): Promise<Task | null> {
    return this.kaneoClient.updateTask(workspaceId, taskId, input);
  }

  async deleteTask(workspaceId: string, taskId: string): Promise<boolean> {
    return this.kaneoClient.deleteTask(workspaceId, taskId);
  }

  async linkWorkflow(workspaceId: string, taskId: string, workflowId: string): Promise<Task | null> {
    return this.kaneoClient.linkWorkflow(workspaceId, taskId, workflowId);
  }
}
