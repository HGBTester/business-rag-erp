require('dotenv').config({ path: __dirname + '/../.env' });
const pool = require('../db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ========================
        // 1. TEMPLATES - Reusable task blueprints
        // ========================
        await client.query(`
            CREATE TABLE IF NOT EXISTS wf_templates (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                domain TEXT NOT NULL CHECK (domain IN ('sales','circuits','marketing','hr')),
                description TEXT,
                default_sla_hours INTEGER NOT NULL DEFAULT 24,
                assignee_rule TEXT NOT NULL DEFAULT 'manual'
                    CHECK (assignee_rule IN ('manual','department','role','round-robin')),
                assignee_department TEXT,
                assignee_role TEXT,
                steps JSONB NOT NULL DEFAULT '[]',
                priority TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','urgent')),
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ========================
        // 2. WORKFLOW DEFINITIONS - Chain of templates
        // ========================
        await client.query(`
            CREATE TABLE IF NOT EXISTS wf_workflow_definitions (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                domain TEXT NOT NULL CHECK (domain IN ('sales','circuits','marketing','hr')),
                description TEXT,
                trigger_type TEXT NOT NULL DEFAULT 'manual'
                    CHECK (trigger_type IN ('manual','auto_on_create','auto_on_status','scheduled')),
                trigger_config JSONB DEFAULT '{}',
                stages JSONB NOT NULL DEFAULT '[]',
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        // stages format: [{ order: 1, template_id: 5, wait_for_previous: true }, ...]

        // ========================
        // 3. WORKFLOW INSTANCES - Running workflows
        // ========================
        await client.query(`
            CREATE TABLE IF NOT EXISTS wf_workflow_instances (
                id SERIAL PRIMARY KEY,
                definition_id INTEGER NOT NULL REFERENCES wf_workflow_definitions(id),
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                entity_name TEXT,
                status TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','completed','cancelled','paused')),
                current_stage INTEGER NOT NULL DEFAULT 1,
                started_by INTEGER REFERENCES system_users(id),
                started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                completed_at TIMESTAMPTZ,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ========================
        // 4. TASKS - Individual work items spawned from templates
        // ========================
        await client.query(`
            CREATE TABLE IF NOT EXISTS wf_tasks (
                id SERIAL PRIMARY KEY,
                workflow_instance_id INTEGER REFERENCES wf_workflow_instances(id),
                template_id INTEGER REFERENCES wf_templates(id),
                title TEXT NOT NULL,
                description TEXT,
                domain TEXT NOT NULL CHECK (domain IN ('sales','circuits','marketing','hr')),
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','assigned','in_progress','completed','cancelled','blocked','overdue')),
                priority TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','urgent')),
                stage_order INTEGER DEFAULT 1,
                assignee_id TEXT,
                assignee_name TEXT,
                assigned_by INTEGER REFERENCES system_users(id),
                entity_type TEXT,
                entity_id TEXT,
                entity_name TEXT,
                steps JSONB NOT NULL DEFAULT '[]',
                steps_completed INTEGER NOT NULL DEFAULT 0,
                steps_total INTEGER NOT NULL DEFAULT 0,
                sla_hours INTEGER NOT NULL DEFAULT 24,
                deadline TIMESTAMPTZ,
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                completed_by TEXT,
                notes TEXT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ========================
        // 5. TASK ACTIVITY LOG
        // ========================
        await client.query(`
            CREATE TABLE IF NOT EXISTS wf_task_activity (
                id SERIAL PRIMARY KEY,
                task_id INTEGER NOT NULL REFERENCES wf_tasks(id) ON DELETE CASCADE,
                action TEXT NOT NULL,
                actor_id TEXT,
                actor_name TEXT,
                details JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ========================
        // 6. PENALTIES
        // ========================
        await client.query(`
            CREATE TABLE IF NOT EXISTS wf_penalties (
                id SERIAL PRIMARY KEY,
                task_id INTEGER NOT NULL REFERENCES wf_tasks(id),
                employee_id TEXT NOT NULL,
                employee_name TEXT,
                penalty_type TEXT NOT NULL,
                amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','waived','deducted')),
                approved_by INTEGER REFERENCES system_users(id),
                approved_at TIMESTAMPTZ,
                payroll_period TEXT,
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ========================
        // 7. NOTIFICATIONS QUEUE
        // ========================
        await client.query(`
            CREATE TABLE IF NOT EXISTS wf_notifications (
                id SERIAL PRIMARY KEY,
                task_id INTEGER REFERENCES wf_tasks(id),
                recipient_phone TEXT,
                recipient_name TEXT,
                message_type TEXT NOT NULL
                    CHECK (message_type IN ('task_assigned','reminder_50','reminder_80','overdue','completed','penalty')),
                message_text TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','sent','failed','skipped')),
                sent_at TIMESTAMPTZ,
                error_message TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ========================
        // 8. EMPLOYEE STATS (aggregated performance)
        // ========================
        await client.query(`
            CREATE TABLE IF NOT EXISTS wf_employee_stats (
                id SERIAL PRIMARY KEY,
                employee_id TEXT NOT NULL UNIQUE,
                employee_name TEXT,
                department TEXT,
                tasks_completed INTEGER NOT NULL DEFAULT 0,
                tasks_on_time INTEGER NOT NULL DEFAULT 0,
                tasks_overdue INTEGER NOT NULL DEFAULT 0,
                current_streak INTEGER NOT NULL DEFAULT 0,
                best_streak INTEGER NOT NULL DEFAULT 0,
                total_penalties NUMERIC(10,2) NOT NULL DEFAULT 0,
                avg_completion_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ========================
        // INDEXES
        // ========================
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_wf_templates_domain ON wf_templates(domain)',
            'CREATE INDEX IF NOT EXISTS idx_wf_templates_active ON wf_templates(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_wf_definitions_domain ON wf_workflow_definitions(domain)',
            'CREATE INDEX IF NOT EXISTS idx_wf_instances_entity ON wf_workflow_instances(entity_type, entity_id)',
            'CREATE INDEX IF NOT EXISTS idx_wf_instances_status ON wf_workflow_instances(status)',
            'CREATE INDEX IF NOT EXISTS idx_wf_instances_definition ON wf_workflow_instances(definition_id)',
            'CREATE INDEX IF NOT EXISTS idx_wf_tasks_workflow ON wf_tasks(workflow_instance_id)',
            'CREATE INDEX IF NOT EXISTS idx_wf_tasks_assignee ON wf_tasks(assignee_id)',
            'CREATE INDEX IF NOT EXISTS idx_wf_tasks_status ON wf_tasks(status)',
            'CREATE INDEX IF NOT EXISTS idx_wf_tasks_domain ON wf_tasks(domain)',
            'CREATE INDEX IF NOT EXISTS idx_wf_tasks_deadline ON wf_tasks(deadline)',
            'CREATE INDEX IF NOT EXISTS idx_wf_tasks_entity ON wf_tasks(entity_type, entity_id)',
            'CREATE INDEX IF NOT EXISTS idx_wf_activity_task ON wf_task_activity(task_id)',
            'CREATE INDEX IF NOT EXISTS idx_wf_penalties_employee ON wf_penalties(employee_id)',
            'CREATE INDEX IF NOT EXISTS idx_wf_penalties_status ON wf_penalties(status)',
            'CREATE INDEX IF NOT EXISTS idx_wf_penalties_task ON wf_penalties(task_id)',
            'CREATE INDEX IF NOT EXISTS idx_wf_notifications_status ON wf_notifications(status)',
            'CREATE INDEX IF NOT EXISTS idx_wf_notifications_task ON wf_notifications(task_id)',
            'CREATE INDEX IF NOT EXISTS idx_wf_stats_employee ON wf_employee_stats(employee_id)',
        ];
        for (const idx of indexes) {
            await client.query(idx);
        }

        // Add department column to system_users if missing (for role-based access)
        try {
            await client.query(`ALTER TABLE system_users ADD COLUMN IF NOT EXISTS department TEXT`);
            await client.query(`ALTER TABLE system_users ADD COLUMN IF NOT EXISTS employee_id TEXT`);
            await client.query(`ALTER TABLE system_users ADD COLUMN IF NOT EXISTS display_name TEXT`);
        } catch (e) {
            // columns might already exist
        }

        await client.query('COMMIT');
        console.log('[MIGRATE] All workflow tables created successfully');
        console.log('[MIGRATE] Tables: wf_templates, wf_workflow_definitions, wf_workflow_instances, wf_tasks, wf_task_activity, wf_penalties, wf_notifications, wf_employee_stats');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[MIGRATE] Error:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch(err => { console.error(err); process.exit(1); });
