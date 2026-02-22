const express = require('express');
const PenaltyEngine = require('../services/penalty-engine');
const router = express.Router();

// List penalties
router.get('/', async (req, res) => {
    try {
        const penalties = await PenaltyEngine.getPenalties({
            status: req.query.status,
            employee_id: req.query.employee_id,
            payroll_period: req.query.payroll_period,
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        });
        res.json(penalties);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Penalty summary by employee
router.get('/summary', async (req, res) => {
    try {
        const summary = await PenaltyEngine.getPenaltySummary();
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Approve penalty (manager only)
router.post('/:id/approve', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        const penalty = await PenaltyEngine.approvePenalty(
            req.params.id,
            req.session.userId,
            req.body.payroll_period
        );
        if (!penalty) return res.status(400).json({ error: 'Penalty not found or already processed' });
        res.json(penalty);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Waive penalty (manager only)
router.post('/:id/waive', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        const penalty = await PenaltyEngine.waivePenalty(
            req.params.id,
            req.session.userId,
            req.body.notes
        );
        if (!penalty) return res.status(400).json({ error: 'Penalty not found or already processed' });
        res.json(penalty);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
