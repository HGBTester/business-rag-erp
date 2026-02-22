const express = require('express');
const WorkflowEngine = require('../services/workflow-engine');
const router = express.Router();

// List tasks with filters
router.get('/', async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            domain: req.query.domain,
            assignee_id: req.query.assignee_id,
            workflow_instance_id: req.query.workflow_instance_id,
            entity_type: req.query.entity_type,
            entity_id: req.query.entity_id,
            overdue: req.query.overdue === 'true',
            limit: req.query.limit ? parseInt(req.query.limit) : 200
        };

        // If employee role, only show their tasks
        if (req.session.role === 'user' && req.session.employeeId) {
            filters.assignee_id = req.session.employeeId;
        }

        const tasks = await WorkflowEngine.getTasks(filters);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// My tasks (current user)
router.get('/mine', async (req, res) => {
    try {
        if (!req.session.employeeId && req.session.role === 'user') {
            return res.json([]);
        }
        const assigneeId = req.session.employeeId || req.session.userId?.toString();
        const tasks = await WorkflowEngine.getTasks({
            assignee_id: assigneeId,
            limit: 100
        });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single task
router.get('/:id', async (req, res) => {
    try {
        const task = await WorkflowEngine.getTask(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        const activity = await WorkflowEngine.getTaskActivity(task.id);
        res.json({ ...task, activity });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create standalone task
router.post('/', async (req, res) => {
    try {
        const task = await WorkflowEngine.createStandaloneTask({
            ...req.body,
            assigned_by: req.session.userId
        });
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Assign task
router.post('/:id/assign', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        const { assignee_id, assignee_name } = req.body;
        const task = await WorkflowEngine.assignTask(req.params.id, assignee_id, assignee_name, req.session.userId);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start task
router.post('/:id/start', async (req, res) => {
    try {
        const task = await WorkflowEngine.startTask(req.params.id, req.session.displayName || req.session.username);
        if (!task) return res.status(400).json({ error: 'Cannot start task (invalid status)' });
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Complete a step
router.post('/:id/step/:stepOrder', async (req, res) => {
    try {
        const task = await WorkflowEngine.completeStep(
            parseInt(req.params.id),
            parseInt(req.params.stepOrder),
            req.session.displayName || req.session.username
        );
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Complete task
router.post('/:id/complete', async (req, res) => {
    try {
        const task = await WorkflowEngine.completeTask(
            req.params.id,
            req.session.displayName || req.session.username,
            req.body.notes
        );
        if (!task) return res.status(400).json({ error: 'Cannot complete task' });
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cancel task
router.post('/:id/cancel', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        const task = await WorkflowEngine.cancelTask(
            req.params.id,
            req.session.displayName || req.session.username,
            req.body.reason
        );
        if (!task) return res.status(400).json({ error: 'Cannot cancel task' });
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
