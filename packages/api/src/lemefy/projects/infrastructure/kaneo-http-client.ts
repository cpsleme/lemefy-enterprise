import type { KaneoClient, CreateProjectInput, UpdateProjectInput, CreateTaskInput, UpdateTaskInput, ListProjectsParams, ListTasksParams, Project, Task } from '../domain';

export interface KaneoWorkspace {
  id: string;
  name: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

export class KaneoHttpClient implements KaneoClient {
  constructor(private readonly baseUrl: string, private readonly apiKey?: string) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...((options?.headers as Record<string, string> | undefined) ?? {}),
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Kaneo API error ${response.status}: ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async createWorkspace(name: string, owner: string): Promise<KaneoWorkspace> {
    return this.request<KaneoWorkspace>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, owner }),
    });
  }

  async listWorkspaces(owner?: string): Promise<KaneoWorkspace[]> {
    const search = new URLSearchParams();
    if (owner) search.set('owner', owner);
    const qs = search.toString();
    return this.request<KaneoWorkspace[]>(`/api/workspaces${qs ? `?${qs}` : ''}`);
  }

  async createProject(workspaceId: string, input: CreateProjectInput): Promise<Project> {
    return this.request<Project>(`/api/workspaces/${encodeURIComponent(workspaceId)}/projects`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getProject(workspaceId: string, projectId: string): Promise<Project | null> {
    try {
      return await this.request<Project>(`/api/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async listProjects(workspaceId: string, params?: ListProjectsParams): Promise<{ projects: Project[]; total: number }> {
    const search = new URLSearchParams();
    if (params?.owner) search.set('owner', params.owner);
    if (params?.status) search.set('status', params.status);
    if (params?.search) search.set('search', params.search);
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.offset) search.set('offset', String(params.offset));

    const qs = search.toString();
    return this.request<{ projects: Project[]; total: number }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/projects${qs ? `?${qs}` : ''}`);
  }

  async updateProject(workspaceId: string, projectId: string, input: UpdateProjectInput): Promise<Project | null> {
    try {
      return await this.request<Project>(`/api/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async deleteProject(workspaceId: string, projectId: string): Promise<boolean> {
    try {
      await this.request(`/api/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  }

  async createTask(workspaceId: string, input: CreateTaskInput): Promise<Task> {
    return this.request<Task>(`/api/workspaces/${encodeURIComponent(workspaceId)}/tasks`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getTask(workspaceId: string, taskId: string): Promise<Task | null> {
    try {
      return await this.request<Task>(`/api/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async listTasks(workspaceId: string, params: ListTasksParams): Promise<{ tasks: Task[]; total: number }> {
    const search = new URLSearchParams();
    search.set('projectId', params.projectId);
    if (params.status) search.set('status', params.status);
    if (params.assignee) search.set('assignee', params.assignee);
    if (params.limit) search.set('limit', String(params.limit));
    if (params.offset) search.set('offset', String(params.offset));

    return this.request<{ tasks: Task[]; total: number }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/tasks?${search.toString()}`);
  }

  async updateTask(workspaceId: string, taskId: string, input: UpdateTaskInput): Promise<Task | null> {
    try {
      return this.request<Task>(`/api/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async deleteTask(workspaceId: string, taskId: string): Promise<boolean> {
    try {
      await this.request(`/api/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  }

  async linkWorkflow(workspaceId: string, taskId: string, workflowId: string): Promise<Task | null> {
    try {
      return this.request<Task>(`/api/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/workflow`, {
        method: 'POST',
        body: JSON.stringify({ workflowId }),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }
}
