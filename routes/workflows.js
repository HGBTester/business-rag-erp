const express = require('express');
const WorkflowEngine = require('../services/workflow-engine');
const router = express.Router();

// List workflow definitions
router.get('/definitions', async (req, res) => {
    try {
        const defs = await WorkflowEngine.getDefinitions(req.query.domain);
        res.json(defs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get workflow definition
router.get('/definitions/:id', async (req, res) => {
    try {
        const def = await WorkflowEngine.getDefinition(req.params.id);
        if (!def) return res.status(404).json({ error: 'Definition not found' });
        res.json(def);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create workflow definition (manager only)
router.post('/definitions', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        const def = await WorkflowEngine.createDefinition(req.body);
        res.json(def);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start a workflow instance (manager only)
router.post('/start', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        const { definition_id, entity_type, entity_id, entity_name } = req.body;
        if (!definition_id) return res.status(400).json({ error: 'definition_id required' });
        const result = await WorkflowEngine.startWorkflow(definition_id, entity_type, entity_id, entity_name, req.session.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List workflow instances
router.get('/instances', async (req, res) => {
    try {
        const instances = await WorkflowEngine.getInstances({
            status: req.query.status,
            domain: req.query.domain,
            entity_type: req.query.entity_type,
            entity_id: req.query.entity_id,
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        });
        res.json(instances);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get workflow instance with tasks (journey map data)
router.get('/instances/:id', async (req, res) => {
    try {
        const instance = await WorkflowEngine.getInstance(req.params.id);
        if (!instance) return res.status(404).json({ error: 'Instance not found' });
        const tasks = await WorkflowEngine.getTasks({ workflow_instance_id: instance.id });
        res.json({ ...instance, tasks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get entity journey (all workflows for an entity)
router.get('/journey/:entityType/:entityId', async (req, res) => {
    try {
        const journey = await WorkflowEngine.getEntityJourney(req.params.entityType, req.params.entityId);
        res.json(journey);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get employees for assignment dropdown
router.get('/employees', async (req, res) => {
    try {
        const employees = await WorkflowEngine.getEmployees(req.query.department);
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
