const pool = require('../db');
const NotificationService = require('./workflow-notifications');
const PenaltyEngine = require('./penalty-engine');

class SLATracker {
    constructor() {
        this.interval = null;
        this.scanIntervalMs = 5 * 60 * 1000; // 5 minutes
    }

    start() {
        console.log('[SLA] Tracker started - scanning every 5 minutes');
        this.scan(); // initial scan
        this.interval = setInterval(() => this.scan(), this.scanIntervalMs);
    }

    stop() {
        if (this.interval) { clearInterval(this.interval); this.interval = null; }
        console.log('[SLA] Tracker stopped');
    }

    async scan() {
        try {
            const now = new Date();

            // Get all active tasks with deadlines
            const { rows: tasks } = await pool.query(`
                SELECT t.*,
                    EXTRACT(EPOCH FROM (t.deadline - NOW())) / 3600 as hours_remaining,
                    EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 as hours_elapsed
                FROM wf_tasks t
                WHERE t.status NOT IN ('completed', 'cancelled')
                    AND t.deadline IS NOT NULL
                ORDER BY t.deadline ASC
            `);

            let overdueCount = 0, warningCount = 0, reminderCount = 0;

            for (const task of tasks) {
                const hoursRemaining = parseFloat(task.hours_remaining);
                const hoursElapsed = parseFloat(task.hours_elapsed);
                const slaHours = task.sla_hours || 24;
                const percentElapsed = (hoursElapsed / slaHours) * 100;

                if (hoursRemaining <= 0) {
                    // OVERDUE
                    overdueCount++;
                    await this._handleOverdue(task);
                } else if (percentElapsed >= 80) {
                    // 80% WARNING
                    warningCount++;
                    await this._handleWarning(task, 80);
                } else if (percentElapsed >= 50) {
                    // 50% REMINDER
                    reminderCount++;
                    await this._handleReminder(task, 50);
                }
            }

            if (overdueCount + warningCount + reminderCount > 0) {
                console.log(`[SLA] Scan complete: ${overdueCount} overdue, ${warningCount} warnings, ${reminderCount} reminders`);
            }
        } catch (err) {
            console.error('[SLA] Scan error:', err.message);
        }
    }

    async _handleOverdue(task) {
        // Mark task as overdue if not already
        if (task.status !== 'overdue') {
            await pool.query(
                `UPDATE wf_tasks SET status='overdue', updated_at=NOW() WHERE id=$1`,
                [task.id]
            );
            await pool.query(
                `INSERT INTO wf_task_activity (task_id, action, actor_name, details) VALUES ($1, 'overdue', 'System', $2)`,
                [task.id, JSON.stringify({ hours_overdue: Math.abs(parseFloat(task.hours_remaining)).toFixed(1) })]
            );
        }

        // Generate penalty
        await PenaltyEngine.evaluateTask(task);

        // Send notification (only if not already sent for this type recently)
        await NotificationService.queueNotification(task, 'overdue');
    }

    async _handleWarning(task, percent) {
        await NotificationService.queueNotification(task, 'reminder_80');
    }

    async _handleReminder(task, percent) {
        await NotificationService.queueNotification(task, 'reminder_50');
    }
}

module.exports = new SLATracker();
