const express = require('express');
const WorkflowEngine = require('../services/workflow-engine');
const pool = require('../db');
const router = express.Router();

// Bird's Eye dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await WorkflowEngine.getDashboardStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Domain detail (tasks + workflows for a domain)
router.get('/domain/:domain', async (req, res) => {
    try {
        const domain = req.params.domain;
        const [tasks, workflows, overdueTasks] = await Promise.all([
            WorkflowEngine.getTasks({ domain, limit: 50 }),
            WorkflowEngine.getInstances({ domain, limit: 20 }),
            WorkflowEngine.getTasks({ domain, overdue: true })
        ]);
        res.json({ domain, tasks, workflows, overdueTasks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT employee_id, employee_name, department,
                tasks_completed, tasks_on_time, tasks_overdue,
                current_streak, best_streak,
                CASE WHEN tasks_completed > 0
                    THEN ROUND((tasks_on_time::numeric / tasks_completed) * 100)
                    ELSE 0 END as on_time_rate,
                avg_completion_hours, total_penalties
            FROM wf_employee_stats
            ORDER BY tasks_completed DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Employee personal stats
router.get('/my-stats', async (req, res) => {
    try {
        const empId = req.session.employeeId || req.session.userId?.toString();
        const { rows } = await pool.query(
            'SELECT * FROM wf_employee_stats WHERE employee_id = $1', [empId]
        );
        res.json(rows[0] || {
            tasks_completed: 0, tasks_on_time: 0, tasks_overdue: 0,
            current_streak: 0, best_streak: 0, avg_completion_hours: 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Entity counts per domain (from shared tables)
router.get('/entity-counts', async (req, res) => {
    try {
        const [circuits, crm, employees] = await Promise.all([
            pool.query(`SELECT COUNT(*) as count FROM clickup_layer3_circuits_900902010182 WHERE is_deleted = false`),
            pool.query(`SELECT COUNT(*) as count FROM clickup_crm_isp_900900441979 WHERE is_deleted = false`),
            pool.query(`SELECT COUNT(*) as count FROM clickup_employees_901202229372 WHERE is_deleted = false AND status = 'on duty'`)
        ]);
        res.json({
            circuits: parseInt(circuits.rows[0].count),
            leads: parseInt(crm.rows[0].count),
            employees: parseInt(employees.rows[0].count)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Recent activity across all tasks
router.get('/activity', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT a.*, t.title as task_title, t.domain
            FROM wf_task_activity a
            JOIN wf_tasks t ON a.task_id = t.id
            ORDER BY a.created_at DESC
            LIMIT $1
        `, [parseInt(req.query.limit) || 30]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CRM leads list for workflow start
router.get('/leads', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, task_name, status, stage, customer, estimated_value, assignees, city
            FROM clickup_crm_isp_900900441979
            WHERE is_deleted = false
            ORDER BY date_updated DESC NULLS LAST
            LIMIT 100
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Circuits list
router.get('/circuits', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, task_name, status, customer, city, service, speed_mbps, mrc, assignees
            FROM clickup_layer3_circuits_900902010182
            WHERE is_deleted = false
            ORDER BY date_updated DESC NULLS LAST
            LIMIT 100
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DSP circuits list
router.get('/dsp-circuits', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, task_name, status, customer, city, service, speed_mbps, mrc, assignees
            FROM clickup_dsp_circuits_900400290457
            WHERE is_deleted = false
            ORDER BY date_updated DESC NULLS LAST
            LIMIT 100
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Notifications queue
router.get('/notifications', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT n.*, t.title as task_title
            FROM wf_notifications n
            LEFT JOIN wf_tasks t ON n.task_id = t.id
            ORDER BY n.created_at DESC
            LIMIT $1
        `, [parseInt(req.query.limit) || 50]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
