const express = require('express');
const WorkflowEngine = require('../services/workflow-engine');
const router = express.Router();

// List templates
router.get('/', async (req, res) => {
    try {
        const templates = await WorkflowEngine.getTemplates(req.query.domain);
        res.json(templates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single template
router.get('/:id', async (req, res) => {
    try {
        const template = await WorkflowEngine.getTemplate(req.params.id);
        if (!template) return res.status(404).json({ error: 'Template not found' });
        res.json(template);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create template (manager only)
router.post('/', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        const template = await WorkflowEngine.createTemplate(req.body);
        res.json(template);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update template (manager only)
router.put('/:id', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        const template = await WorkflowEngine.updateTemplate(req.params.id, req.body);
        if (!template) return res.status(404).json({ error: 'Template not found' });
        res.json(template);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
