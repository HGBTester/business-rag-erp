const pool = require('../db');

const PenaltyEngine = {
    // Penalty rules: hours_overdue → amount
    rules: [
        { maxHours: 24, amount: 50, type: 'minor_delay', label: 'Overdue < 24h' },
        { maxHours: 72, amount: 150, type: 'moderate_delay', label: 'Overdue 1-3 days' },
        { maxHours: Infinity, amount: 300, type: 'severe_delay', label: 'Overdue > 3 days' },
    ],
    cancelledOverdueAmount: 500,

    async evaluateTask(task) {
        if (!task.assignee_id) return null;
        if (!task.deadline) return null;

        const now = new Date();
        const deadline = new Date(task.deadline);
        if (now <= deadline && task.status !== 'cancelled') return null;

        // Check if penalty already exists for this task
        const { rows: existing } = await pool.query(
            `SELECT id FROM wf_penalties WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [task.id]
        );

        const hoursOverdue = (now - deadline) / 3600000;

        // Determine penalty amount
        let amount, type, reason;

        if (task.status === 'cancelled') {
            amount = this.cancelledOverdueAmount;
            type = 'cancelled_overdue';
            reason = `Task "${task.title}" cancelled while overdue by ${hoursOverdue.toFixed(1)}h`;
        } else {
            const rule = this.rules.find(r => hoursOverdue <= r.maxHours);
            if (!rule) return null;

            // If penalty exists and same tier, skip
            if (existing.length > 0) {
                const { rows: [lastPenalty] } = await pool.query(
                    'SELECT penalty_type, amount FROM wf_penalties WHERE id = $1', [existing[0].id]
                );
                if (lastPenalty && lastPenalty.amount >= rule.amount) return null;
            }

            amount = rule.amount;
            type = rule.type;
            reason = `Task "${task.title}" overdue by ${hoursOverdue.toFixed(1)}h (${rule.label})`;
        }

        // If there's already a lower penalty, upgrade it
        if (existing.length > 0) {
            const { rows } = await pool.query(
                `UPDATE wf_penalties SET amount=$1, penalty_type=$2, reason=$3, updated_at=NOW()
                 WHERE id=$4 AND status='pending' RETURNING *`,
                [amount, type, reason, existing[0].id]
            );
            return rows[0] || null;
        }

        // Create new penalty
        const { rows } = await pool.query(
            `INSERT INTO wf_penalties (task_id, employee_id, employee_name, penalty_type, amount, reason)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [task.id, task.assignee_id, task.assignee_name, type, amount, reason]
        );

        return rows[0];
    },

    async getPenalties(filters = {}) {
        let sql = 'SELECT p.*, t.title as task_title, t.domain FROM wf_penalties p LEFT JOIN wf_tasks t ON p.task_id = t.id WHERE 1=1';
        const params = [];
        let idx = 1;

        if (filters.status) { sql += ` AND p.status = $${idx++}`; params.push(filters.status); }
        if (filters.employee_id) { sql += ` AND p.employee_id = $${idx++}`; params.push(filters.employee_id); }
        if (filters.payroll_period) { sql += ` AND p.payroll_period = $${idx++}`; params.push(filters.payroll_period); }

        sql += ' ORDER BY p.created_at DESC';
        if (filters.limit) { sql += ` LIMIT $${idx++}`; params.push(filters.limit); }

        const { rows } = await pool.query(sql, params);
        return rows;
    },

    async approvePenalty(penaltyId, approvedBy, payrollPeriod) {
        const { rows } = await pool.query(
            `UPDATE wf_penalties SET status='approved', approved_by=$1, approved_at=NOW(),
                payroll_period=$2, updated_at=NOW()
             WHERE id=$3 AND status='pending' RETURNING *`,
            [approvedBy, payrollPeriod, penaltyId]
        );
        if (rows[0]) {
            // Update employee total penalties
            await pool.query(
                `UPDATE wf_employee_stats SET total_penalties = total_penalties + $1, updated_at=NOW()
                 WHERE employee_id = $2`,
                [rows[0].amount, rows[0].employee_id]
            );
        }
        return rows[0];
    },

    async waivePenalty(penaltyId, approvedBy, notes) {
        const { rows } = await pool.query(
            `UPDATE wf_penalties SET status='waived', approved_by=$1, approved_at=NOW(),
                notes=$2, updated_at=NOW()
             WHERE id=$3 AND status='pending' RETURNING *`,
            [approvedBy, notes, penaltyId]
        );
        return rows[0];
    },

    async getPenaltySummary() {
        const { rows } = await pool.query(`
            SELECT
                p.employee_id, p.employee_name,
                COUNT(*) as total_penalties,
                SUM(CASE WHEN p.status='pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN p.status='approved' THEN 1 ELSE 0 END) as approved_count,
                SUM(CASE WHEN p.status='waived' THEN 1 ELSE 0 END) as waived_count,
                SUM(CASE WHEN p.status='approved' THEN p.amount ELSE 0 END) as total_approved_amount,
                SUM(CASE WHEN p.status='pending' THEN p.amount ELSE 0 END) as total_pending_amount
            FROM wf_penalties p
            GROUP BY p.employee_id, p.employee_name
            ORDER BY total_pending_amount DESC
        `);
        return rows;
    }
};

module.exports = PenaltyEngine;
