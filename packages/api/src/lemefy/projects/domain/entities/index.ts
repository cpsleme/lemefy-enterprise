export type ProjectStatus = 'active' | 'archived' | 'planning';
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Project {
  id: string;
  name: string;
  description: string;
  owner: string;
  team: string[];
  tags: string[];
  status: ProjectStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string;
  tags: string[];
  workflowId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
