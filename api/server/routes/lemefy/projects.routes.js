const { Router } = require('express');
const { logger } = require('@lemefy/data-schemas');

const router = Router();

router.post('/projects', async (req, res) => {
  try {
    const { name, description, owner, team, tags, dueDate } = req.body;
    if (!name || !owner) {
      return res.status(400).json({ error: 'name and owner are required' });
    }
    const project = lemefyService.kaneo.server.createProject({ name, description, owner, team, tags, dueDate });
    res.status(201).json(project);
  } catch (error) {
    logger.error('[lemefy] Error creating project', error);
    res.status(500).json({ error: 'Error creating project' });
  }
});

router.get('/projects', async (req, res) => {
  try {
    const { owner, status, search, limit, offset } = req.query;
    const result = lemefyService.kaneo.server.listProjects({
      owner,
      status,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (error) {
    logger.error('[lemefy] Error listing projects', error);
    res.status(500).json({ error: 'Error listing projects' });
  }
});

router.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const project = lemefyService.kaneo.server.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(200).json(project);
  } catch (error) {
    logger.error('[lemefy] Error getting project', error);
    res.status(500).json({ error: 'Error getting project' });
  }
});

router.patch('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const project = lemefyService.kaneo.server.updateProject(id, updates);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(200).json(project);
  } catch (error) {
    logger.error('[lemefy] Error updating project', error);
    res.status(500).json({ error: 'Error updating project' });
  }
});

router.delete('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = lemefyService.kaneo.server.deleteProject(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(200).json({ message: `Project ${id} deleted` });
  } catch (error) {
    logger.error('[lemefy] Error deleting project', error);
    res.status(500).json({ error: 'Error deleting project' });
  }
});

router.post('/projects/:projectId/tasks', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, assignee, dueDate, priority, tags } = req.body;
    if (!title || !assignee || !dueDate) {
      return res.status(400).json({ error: 'title, assignee, and dueDate are required' });
    }
    const task = lemefyService.kaneo.server.createTask({
      projectId,
      title,
      description,
      assignee,
      dueDate,
      priority,
      tags,
    });
    res.status(201).json(task);
  } catch (error) {
    logger.error('[lemefy] Error creating task', error);
    res.status(500).json({ error: 'Error creating task' });
  }
});

router.get('/projects/:projectId/tasks', async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = lemefyService.kaneo.server.getProjectTasks(projectId);
    res.status(200).json({ tasks, count: tasks.length });
  } catch (error) {
    logger.error('[lemefy] Error listing tasks', error);
    res.status(500).json({ error: 'Error listing tasks' });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const { projectId, status, assignee, priority, search, limit, offset } = req.query;
    const result = lemefyService.kaneo.server.listTasks({
      projectId,
      status,
      assignee,
      priority,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (error) {
    logger.error('[lemefy] Error listing tasks', error);
    res.status(500).json({ error: 'Error listing tasks' });
  }
});

router.get('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = lemefyService.kaneo.server.getTask(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(200).json(task);
  } catch (error) {
    logger.error('[lemefy] Error getting task', error);
    res.status(500).json({ error: 'Error getting task' });
  }
});

router.patch('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const task = lemefyService.kaneo.server.updateTask(id, updates);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(200).json(task);
  } catch (error) {
    logger.error('[lemefy] Error updating task', error);
    res.status(500).json({ error: 'Error updating task' });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = lemefyService.kaneo.server.deleteTask(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(200).json({ message: `Task ${id} deleted` });
  } catch (error) {
    logger.error('[lemefy] Error deleting task', error);
    res.status(500).json({ error: 'Error deleting task' });
  }
});

module.exports = router;