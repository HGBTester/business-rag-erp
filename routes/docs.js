const express = require('express');
const pool = require('../db');
const router = express.Router();

// Get all documentation sections
router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM wf_documentation ORDER BY sort_order, id'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a section (manager only)
router.put('/:id', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        const { title, content } = req.body;
        const { rows } = await pool.query(
            `UPDATE wf_documentation SET title = COALESCE($1, title), content = COALESCE($2, content),
             updated_by = $3, updated_at = NOW() WHERE id = $4 RETURNING *`,
            [title, content, req.session.displayName || req.session.username, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Section not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new section (manager only)
router.post('/', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        const { section_key, title, content, sort_order } = req.body;
        const { rows } = await pool.query(
            `INSERT INTO wf_documentation (section_key, title, content, sort_order, updated_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [section_key, title, content || '', sort_order || 0, req.session.displayName || req.session.username]
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a section (manager only)
router.delete('/:id', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        await pool.query('DELETE FROM wf_documentation WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reorder sections (manager only)
router.post('/reorder', async (req, res) => {
    try {
        if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
        const { order } = req.body; // [{id, sort_order}, ...]
        for (const item of order) {
            await pool.query('UPDATE wf_documentation SET sort_order = $1 WHERE id = $2', [item.sort_order, item.id]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
