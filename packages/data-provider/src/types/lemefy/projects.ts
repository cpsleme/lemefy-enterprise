export interface LemefyProject {
  id: string;
  name: string;
  description: string;
  owner: string;
  team: string[];
  tags: string[];
  status: 'active' | 'archived' | 'planning';
  complianceStatus: 'compliant' | 'non-compliant' | 'pending-review';
  budget?: {
    amount: number;
    currency: string;
    spent: number;
    periodStart: string;
    periodEnd: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LemefyTask {
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