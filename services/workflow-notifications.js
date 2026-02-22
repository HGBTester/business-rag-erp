const pool = require('../db');

const NotificationService = {
    async queueNotification(task, messageType) {
        // Check if this notification type was already sent for this task recently (within 4 hours)
        const { rows: recent } = await pool.query(
            `SELECT id FROM wf_notifications
             WHERE task_id=$1 AND message_type=$2 AND created_at > NOW() - INTERVAL '4 hours'`,
            [task.id, messageType]
        );
        if (recent.length > 0) return null; // Already sent recently

        // Get recipient phone
        let phone = null;
        let recipientName = task.assignee_name || 'Unknown';

        if (task.assignee_id) {
            const { rows } = await pool.query(
                `SELECT personal_phone, business_phone FROM clickup_employees_901202229372
                 WHERE id = $1`, [task.assignee_id]
            );
            if (rows[0]) {
                phone = rows[0].business_phone || rows[0].personal_phone;
            }
        }

        // Build message
        const message = this._buildMessage(task, messageType);

        const { rows } = await pool.query(
            `INSERT INTO wf_notifications (task_id, recipient_phone, recipient_name, message_type, message_text)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [task.id, phone, recipientName, messageType, message]
        );

        return rows[0];
    },

    _buildMessage(task, type) {
        const deadline = task.deadline ? new Date(task.deadline).toLocaleString('en-SA') : 'N/A';
        const hoursLeft = task.deadline
            ? ((new Date(task.deadline) - new Date()) / 3600000).toFixed(1)
            : '?';

        switch (type) {
            case 'task_assigned':
                return `📋 New Task: ${task.title}\n` +
                       `Domain: ${task.domain}\n` +
                       `Deadline: ${deadline}\n` +
                       `Steps: ${task.steps_total}\n` +
                       `Priority: ${task.priority}`;

            case 'reminder_50':
                return `⏰ Reminder: ${task.title}\n` +
                       `50% of time has elapsed\n` +
                       `${Math.max(0, hoursLeft)}h remaining\n` +
                       `Deadline: ${deadline}`;

            case 'reminder_80':
                return `⚠️ URGENT: ${task.title}\n` +
                       `80% of time has elapsed!\n` +
                       `Only ${Math.max(0, hoursLeft)}h remaining\n` +
                       `Deadline: ${deadline}`;

            case 'overdue':
                return `🔴 OVERDUE: ${task.title}\n` +
                       `Deadline was: ${deadline}\n` +
                       `Overdue by: ${Math.abs(hoursLeft)}h\n` +
                       `Please complete ASAP!`;

            case 'completed':
                return `✅ Completed: ${task.title}\n` +
                       `Completed by: ${task.completed_by || task.assignee_name}`;

            case 'penalty':
                return `⚠️ Penalty Notice for task: ${task.title}\n` +
                       `Action required by management`;

            default:
                return `Notification for task: ${task.title}`;
        }
    },

    async getNotifications(filters = {}) {
        let sql = 'SELECT * FROM wf_notifications WHERE 1=1';
        const params = [];
        let idx = 1;

        if (filters.status) { sql += ` AND status = $${idx++}`; params.push(filters.status); }
        if (filters.task_id) { sql += ` AND task_id = $${idx++}`; params.push(filters.task_id); }
        if (filters.recipient_name) { sql += ` AND recipient_name ILIKE $${idx++}`; params.push(`%${filters.recipient_name}%`); }

        sql += ' ORDER BY created_at DESC';
        if (filters.limit) { sql += ` LIMIT $${idx++}`; params.push(filters.limit); }

        const { rows } = await pool.query(sql, params);
        return rows;
    },

    async markSent(notificationId) {
        const { rows } = await pool.query(
            `UPDATE wf_notifications SET status='sent', sent_at=NOW() WHERE id=$1 RETURNING *`,
            [notificationId]
        );
        return rows[0];
    },

    async getQueuedCount() {
        const { rows } = await pool.query(
            `SELECT COUNT(*) as count FROM wf_notifications WHERE status='queued'`
        );
        return parseInt(rows[0].count);
    }
};

module.exports = NotificationService;
