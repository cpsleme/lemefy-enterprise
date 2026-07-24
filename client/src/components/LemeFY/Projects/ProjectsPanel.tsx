import { useState } from 'react';
import { useLocalize } from '~/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '~/utils';

function useProjects(params: {
  owner?: string;
  status?: string;
  search?: string;
  limit?: number;
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.owner) searchParams.set('owner', params.owner);
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  if (params.limit) searchParams.set('limit', String(params.limit));
  return useQuery({
    queryKey: ['lemefy', 'projects', params],
    queryFn: async () => {
      const response = await fetch(`/api/lemefy/projects?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    staleTime: 30 * 1000,
  });
}

function useProjectTasks(projectId: string | null) {
  const searchParams = new URLSearchParams();
  if (projectId) searchParams.set('projectId', projectId);
  return useQuery({
    queryKey: ['lemefy', 'tasks', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/lemefy/projects/${encodeURIComponent(projectId ?? '')}/tasks`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      owner: string;
      description?: string;
      team?: string[];
      tags?: string[];
      dueDate?: string;
    }) => {
      const response = await fetch('/api/lemefy/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to create project');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lemefy', 'projects'] });
    },
  });
}

function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      assignee: string;
      dueDate: string;
      description?: string;
      priority?: string;
      tags?: string[];
      workflowId?: string;
    }) => {
      const response = await fetch(
        `/api/lemefy/projects/${encodeURIComponent(projectId)}/tasks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      if (!response.ok) throw new Error('Failed to create task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lemefy', 'tasks'] });
    },
  });
}

const STATUS_OPTIONS = ['todo', 'in-progress', 'review', 'done', 'cancelled'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

export default function ProjectsPanel() {
  const localize = useLocalize();
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: projects, isLoading } = useProjects({ search, limit: 25 });
  const { data: tasks } = useProjectTasks(selectedProjectId);
  const createProject = useCreateProject();
  const createTask = useCreateTask(selectedProjectId ?? '');

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectOwner, setNewProjectOwner] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');

  return (
    <div className="lemefy-projects">
      <h3>{localize('Project & Task Management (Kaneo)')}</h3>

      {view === 'list' && (
        <>
          <div className="lemefy-projects-toolbar">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={localize('Search projects...')}
            />
            <button onClick={() => setView('create')}>{localize('New Project')}</button>
          </div>

          {isLoading && <div className="lemefy-loading">{localize('Loading projects...')}</div>}

          {projects?.projects?.map((project: any) => (
            <div key={project.id} className="lemefy-project-card">
              <h4>{project.name}</h4>
              <p>{project.description}</p>
              <span className="lemefy-project-status">{project.status}</span>
              <span className="lemefy-project-owner">{project.owner}</span>
              <button onClick={() => { setSelectedProjectId(project.id); setView('detail'); }}>
                {localize('View Tasks')}
              </button>
            </div>
          ))}
        </>
      )}

      {view === 'create' && (
        <div className="lemefy-create-project">
          <h4>{localize('Create New Project')}</h4>
          <label>{localize('Name')}</label>
          <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} required />
          <label>{localize('Owner')}</label>
          <input value={newProjectOwner} onChange={(e) => setNewProjectOwner(e.target.value)} required />
          <label>{localize('Description')}</label>
          <textarea value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} rows={3} />
          <button
            onClick={() => {
              createProject.mutate(
                { name: newProjectName, owner: newProjectOwner, description: newProjectDesc },
                {
                  onSuccess: () => {
                    setView('list');
                    setNewProjectName('');
                    setNewProjectOwner('');
                    setNewProjectDesc('');
                  },
                },
              );
            }}
            disabled={createProject.isPending}
          >
            {createProject.isPending ? localize('Creating...') : localize('Create Project')}
          </button>
        </div>
      )}

      {view === 'detail' && selectedProjectId && (
        <div className="lemefy-project-detail">
          <button onClick={() => setView('list')}>{localize('Back to Projects')}</button>
          <h4>{localize('Tasks')}</h4>

          {tasks?.tasks?.map((task: any) => (
            <div key={task.id} className="lemefy-task-item">
              <strong>{task.title}</strong>
              <span>{task.status}</span>
              <span>{task.assignee}</span>
              <span>{task.dueDate}</span>
            </div>
          ))}

          <h5>{localize('Add Task')}</h5>
          <label>{localize('Title')}</label>
          <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} required />
          <label>{localize('Assignee')}</label>
          <input value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} required />
          <label>{localize('Due Date')}</label>
          <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} required />
          <label>{localize('Priority')}</label>
          <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={() => {
              createTask.mutate(
                { title: newTaskTitle, assignee: newTaskAssignee, dueDate: newTaskDueDate, priority: newTaskPriority },
                {
                  onSuccess: () => {
                    setNewTaskTitle('');
                    setNewTaskAssignee('');
                    setNewTaskDueDate('');
                    setNewTaskPriority('medium');
                  },
                },
              );
            }}
            disabled={createTask.isPending}
          >
            {createTask.isPending ? localize('Creating...') : localize('Add Task')}
          </button>
        </div>
      )}
    </div>
  );
}