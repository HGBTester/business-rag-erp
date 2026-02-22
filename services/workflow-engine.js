const pool = require('../db');

const WorkflowEngine = {
    // ===================== TEMPLATES =====================
    async getTemplates(domain = null) {
        let sql = 'SELECT * FROM wf_templates WHERE is_active = true';
        const params = [];
        if (domain) { sql += ' AND domain = $1'; params.push(domain); }
        sql += ' ORDER BY domain, name';
        const { rows } = await pool.query(sql, params);
        return rows;
    },

    async getTemplate(id) {
        const { rows } = await pool.query('SELECT * FROM wf_templates WHERE id = $1', [id]);
        return rows[0] || null;
    },

    async createTemplate(data) {
        const { rows } = await pool.query(
            `INSERT INTO wf_templates (name, domain, description, default_sla_hours, assignee_rule, assignee_department, assignee_role, steps, priority)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [data.name, data.domain, data.description, data.default_sla_hours || 24,
             data.assignee_rule || 'manual', data.assignee_department, data.assignee_role,
             JSON.stringify(data.steps || []), data.priority || 'medium']
        );
        return rows[0];
    },

    async updateTemplate(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;
        for (const key of ['name','domain','description','default_sla_hours','assignee_rule','assignee_department','assignee_role','priority','is_active']) {
            if (data[key] !== undefined) {
                fields.push(`${key} = $${idx++}`);
                params.push(data[key]);
            }
        }
        if (data.steps !== undefined) {
            fields.push(`steps = $${idx++}`);
            params.push(JSON.stringify(data.steps));
        }
        fields.push(`updated_at = NOW()`);
        params.push(id);
        const { rows } = await pool.query(
            `UPDATE wf_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params
        );
        return rows[0];
    },

    // ===================== WORKFLOW DEFINITIONS =====================
    async getDefinitions(domain = null) {
        let sql = 'SELECT * FROM wf_workflow_definitions WHERE is_active = true';
        const params = [];
        if (domain) { sql += ' AND domain = $1'; params.push(domain); }
        sql += ' ORDER BY domain, name';
        const { rows } = await pool.query(sql, params);
        return rows;
    },

    async getDefinition(id) {
        const { rows } = await pool.query('SELECT * FROM wf_workflow_definitions WHERE id = $1', [id]);
        return rows[0] || null;
    },

    async createDefinition(data) {
        const { rows } = await pool.query(
            `INSERT INTO wf_workflow_definitions (name, domain, description, trigger_type, trigger_config, stages)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [data.name, data.domain, data.description, data.trigger_type || 'manual',
             JSON.stringify(data.trigger_config || {}), JSON.stringify(data.stages || [])]
        );
        return rows[0];
    },

    // ===================== START WORKFLOW =====================
    async startWorkflow(definitionId, entityType, entityId, entityName, startedBy) {
        const def = await this.getDefinition(definitionId);
        if (!def) throw new Error('Workflow definition not found');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create workflow instance
            const { rows: [instance] } = await client.query(
                `INSERT INTO wf_workflow_instances (definition_id, entity_type, entity_id, entity_name, started_by)
                 VALUES ($1,$2,$3,$4,$5) RETURNING *`,
                [definitionId, entityType, entityId, entityName, startedBy]
            );

            // Create tasks for stage 1 (or all stages that don't wait)
            const stages = def.stages || [];
            const createdTasks = [];

            for (const stage of stages) {
                if (stage.order > 1 && stage.wait_for_previous !== false) break;

                const template = await this.getTemplate(stage.template_id);
                if (!template) continue;

                const task = await this._createTaskFromTemplate(client, template, instance, stage, entityType, entityId, entityName);
                createdTasks.push(task);
            }

            await client.query('COMMIT');
            return { instance, tasks: createdTasks };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async _createTaskFromTemplate(client, template, instance, stage, entityType, entityId, entityName) {
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + (template.default_sla_hours || 24));

        const steps = (template.steps || []).map((s, i) => ({
            order: i + 1,
            name: typeof s === 'string' ? s : s.name,
            completed: false,
            completed_at: null,
            completed_by: null
        }));

        // Auto-assign based on rule
        let assigneeId = null, assigneeName = null;
        if (template.assignee_rule === 'department' && template.assignee_department) {
            const emp = await this._findEmployeeByDept(client, template.assignee_department);
            if (emp) { assigneeId = emp.id; assigneeName = emp.employee_name; }
        }

        const { rows: [task] } = await client.query(
            `INSERT INTO wf_tasks (workflow_instance_id, template_id, title, description, domain, priority,
                stage_order, assignee_id, assignee_name, entity_type, entity_id, entity_name,
                steps, steps_total, sla_hours, deadline, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
            [instance.id, template.id, template.name, template.description, template.domain, template.priority,
             stage.order, assigneeId, assigneeName, entityType, entityId, entityName,
             JSON.stringify(steps), steps.length, template.default_sla_hours,
             deadline, assigneeId ? 'assigned' : 'pending']
        );

        // Log activity
        await client.query(
            `INSERT INTO wf_task_activity (task_id, action, actor_name, details) VALUES ($1, 'created', 'System', $2)`,
            [task.id, JSON.stringify({ template: template.name, workflow: instance.id })]
        );

        return task;
    },

    async _findEmployeeByDept(client, department) {
        const { rows } = await client.query(
            `SELECT id, employee_name FROM clickup_employees_901202229372
             WHERE department ILIKE $1 AND status = 'on duty' AND is_deleted = false
             ORDER BY RANDOM() LIMIT 1`,
            [`%${department}%`]
        );
        return rows[0] || null;
    },

    // ===================== TASK OPERATIONS =====================
    async getTasks(filters = {}) {
        let sql = 'SELECT * FROM wf_tasks WHERE 1=1';
        const params = [];
        let idx = 1;

        if (filters.status) { sql += ` AND status = $${idx++}`; params.push(filters.status); }
        if (filters.domain) { sql += ` AND domain = $${idx++}`; params.push(filters.domain); }
        if (filters.assignee_id) { sql += ` AND assignee_id = $${idx++}`; params.push(filters.assignee_id); }
        if (filters.workflow_instance_id) { sql += ` AND workflow_instance_id = $${idx++}`; params.push(filters.workflow_instance_id); }
        if (filters.entity_type) { sql += ` AND entity_type = $${idx++}`; params.push(filters.entity_type); }
        if (filters.entity_id) { sql += ` AND entity_id = $${idx++}`; params.push(filters.entity_id); }
        if (filters.overdue) { sql += ` AND deadline < NOW() AND status NOT IN ('completed','cancelled')`; }

        sql += ' ORDER BY CASE priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END, deadline ASC NULLS LAST';
        if (filters.limit) { sql += ` LIMIT $${idx++}`; params.push(filters.limit); }

        const { rows } = await pool.query(sql, params);
        return rows;
    },

    async getTask(id) {
        const { rows } = await pool.query('SELECT * FROM wf_tasks WHERE id = $1', [id]);
        return rows[0] || null;
    },

    async assignTask(taskId, assigneeId, assigneeName, assignedBy) {
        const { rows } = await pool.query(
            `UPDATE wf_tasks SET assignee_id=$1, assignee_name=$2, assigned_by=$3, status='assigned', updated_at=NOW()
             WHERE id=$4 RETURNING *`,
            [assigneeId, assigneeName, assignedBy, taskId]
        );
        if (rows[0]) {
            await pool.query(
                `INSERT INTO wf_task_activity (task_id, action, actor_name, details) VALUES ($1,'assigned',$2,$3)`,
                [taskId, assigneeName, JSON.stringify({ assigned_by: assignedBy })]
            );
        }
        return rows[0];
    },

    async startTask(taskId, actorName) {
        const { rows } = await pool.query(
            `UPDATE wf_tasks SET status='in_progress', started_at=NOW(), updated_at=NOW()
             WHERE id=$1 AND status IN ('pending','assigned') RETURNING *`,
            [taskId]
        );
        if (rows[0]) {
            await pool.query(
                `INSERT INTO wf_task_activity (task_id, action, actor_name) VALUES ($1,'started',$2)`,
                [taskId, actorName]
            );
        }
        return rows[0];
    },

    async completeStep(taskId, stepOrder, actorName) {
        const task = await this.getTask(taskId);
        if (!task) throw new Error('Task not found');

        const steps = task.steps || [];
        const step = steps.find(s => s.order === stepOrder);
        if (!step) throw new Error('Step not found');

        step.completed = true;
        step.completed_at = new Date().toISOString();
        step.completed_by = actorName;

        const completed = steps.filter(s => s.completed).length;

        const { rows } = await pool.query(
            `UPDATE wf_tasks SET steps=$1, steps_completed=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
            [JSON.stringify(steps), completed, taskId]
        );

        await pool.query(
            `INSERT INTO wf_task_activity (task_id, action, actor_name, details) VALUES ($1,'step_completed',$2,$3)`,
            [taskId, actorName, JSON.stringify({ step: step.name, order: stepOrder })]
        );

        return rows[0];
    },

    async completeTask(taskId, actorName, notes) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { rows: [task] } = await client.query(
                `UPDATE wf_tasks SET status='completed', completed_at=NOW(), completed_by=$1, notes=COALESCE($2, notes), updated_at=NOW()
                 WHERE id=$3 AND status NOT IN ('completed','cancelled') RETURNING *`,
                [actorName, notes, taskId]
            );
            if (!task) { await client.query('ROLLBACK'); return null; }

            await client.query(
                `INSERT INTO wf_task_activity (task_id, action, actor_name, details) VALUES ($1,'completed',$2,$3)`,
                [taskId, actorName, JSON.stringify({ notes })]
            );

            // Update employee stats
            await this._updateEmployeeStats(client, task);

            // Check if we need to advance the workflow
            if (task.workflow_instance_id) {
                await this._advanceWorkflow(client, task);
            }

            await client.query('COMMIT');
            return task;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async cancelTask(taskId, actorName, reason) {
        const { rows } = await pool.query(
            `UPDATE wf_tasks SET status='cancelled', notes=$1, updated_at=NOW()
             WHERE id=$2 AND status NOT IN ('completed','cancelled') RETURNING *`,
            [reason, taskId]
        );
        if (rows[0]) {
            await pool.query(
                `INSERT INTO wf_task_activity (task_id, action, actor_name, details) VALUES ($1,'cancelled',$2,$3)`,
                [taskId, actorName, JSON.stringify({ reason })]
            );
        }
        return rows[0];
    },

    async _advanceWorkflow(client, completedTask) {
        const { rows: [instance] } = await client.query(
            'SELECT * FROM wf_workflow_instances WHERE id = $1', [completedTask.workflow_instance_id]
        );
        if (!instance || instance.status !== 'active') return;

        const def = await this.getDefinition(instance.definition_id);
        if (!def) return;

        // Check if all tasks for current stage are done
        const { rows: pendingTasks } = await client.query(
            `SELECT id FROM wf_tasks WHERE workflow_instance_id=$1 AND stage_order=$2 AND status NOT IN ('completed','cancelled')`,
            [instance.id, completedTask.stage_order]
        );
        if (pendingTasks.length > 0) return; // still tasks pending in current stage

        // Find next stage
        const stages = def.stages || [];
        const nextStage = stages.find(s => s.order === completedTask.stage_order + 1);

        if (!nextStage) {
            // Workflow complete
            await client.query(
                `UPDATE wf_workflow_instances SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1`,
                [instance.id]
            );
            return;
        }

        // Advance to next stage
        await client.query(
            `UPDATE wf_workflow_instances SET current_stage=$1, updated_at=NOW() WHERE id=$2`,
            [nextStage.order, instance.id]
        );

        // Create tasks for next stage
        const template = await this.getTemplate(nextStage.template_id);
        if (template) {
            await this._createTaskFromTemplate(client, template, instance, nextStage,
                instance.entity_type, instance.entity_id, instance.entity_name);
        }
    },

    async _updateEmployeeStats(client, task) {
        if (!task.assignee_id) return;
        const onTime = task.deadline && task.completed_at && new Date(task.completed_at) <= new Date(task.deadline);
        const hours = task.started_at
            ? (new Date(task.completed_at) - new Date(task.started_at)) / 3600000
            : 0;

        await client.query(`
            INSERT INTO wf_employee_stats (employee_id, employee_name, department, tasks_completed, tasks_on_time, avg_completion_hours, updated_at)
            VALUES ($1, $2, '', 1, $3, $4, NOW())
            ON CONFLICT (employee_id) DO UPDATE SET
                tasks_completed = wf_employee_stats.tasks_completed + 1,
                tasks_on_time = wf_employee_stats.tasks_on_time + $3,
                avg_completion_hours = (wf_employee_stats.avg_completion_hours * wf_employee_stats.tasks_completed + $4) / (wf_employee_stats.tasks_completed + 1),
                updated_at = NOW()
        `, [task.assignee_id, task.assignee_name, onTime ? 1 : 0, hours]);
    },

    // ===================== WORKFLOW INSTANCES =====================
    async getInstances(filters = {}) {
        let sql = 'SELECT wi.*, wd.name as workflow_name, wd.domain FROM wf_workflow_instances wi JOIN wf_workflow_definitions wd ON wi.definition_id = wd.id WHERE 1=1';
        const params = [];
        let idx = 1;
        if (filters.status) { sql += ` AND wi.status = $${idx++}`; params.push(filters.status); }
        if (filters.domain) { sql += ` AND wd.domain = $${idx++}`; params.push(filters.domain); }
        if (filters.entity_type) { sql += ` AND wi.entity_type = $${idx++}`; params.push(filters.entity_type); }
        if (filters.entity_id) { sql += ` AND wi.entity_id = $${idx++}`; params.push(filters.entity_id); }
        sql += ' ORDER BY wi.created_at DESC';
        if (filters.limit) { sql += ` LIMIT $${idx++}`; params.push(filters.limit); }
        const { rows } = await pool.query(sql, params);
        return rows;
    },

    async getInstance(id) {
        const { rows } = await pool.query(
            `SELECT wi.*, wd.name as workflow_name, wd.domain, wd.stages as definition_stages
             FROM wf_workflow_instances wi JOIN wf_workflow_definitions wd ON wi.definition_id = wd.id
             WHERE wi.id = $1`, [id]
        );
        return rows[0] || null;
    },

    // ===================== DASHBOARD STATS =====================
    async getDashboardStats() {
        const domains = ['sales', 'circuits', 'marketing', 'hr'];
        const stats = {};

        for (const domain of domains) {
            const [active, overdue, completed, total] = await Promise.all([
                pool.query(`SELECT COUNT(*) as count FROM wf_tasks WHERE domain=$1 AND status NOT IN ('completed','cancelled')`, [domain]),
                pool.query(`SELECT COUNT(*) as count FROM wf_tasks WHERE domain=$1 AND deadline < NOW() AND status NOT IN ('completed','cancelled')`, [domain]),
                pool.query(`SELECT COUNT(*) as count FROM wf_tasks WHERE domain=$1 AND status='completed'`, [domain]),
                pool.query(`SELECT COUNT(*) as count FROM wf_tasks WHERE domain=$1`, [domain]),
            ]);

            const totalCount = parseInt(total.rows[0].count) || 1;
            const completedCount = parseInt(completed.rows[0].count);
            const activeCount = parseInt(active.rows[0].count);
            const overdueCount = parseInt(overdue.rows[0].count);

            stats[domain] = {
                active: activeCount,
                overdue: overdueCount,
                completed: completedCount,
                total: parseInt(total.rows[0].count),
                completion_rate: Math.round((completedCount / totalCount) * 100),
                revenue_at_risk: overdueCount * 5000 // estimated
            };
        }

        return stats;
    },

    async getTaskActivity(taskId, limit = 50) {
        const { rows } = await pool.query(
            'SELECT * FROM wf_task_activity WHERE task_id = $1 ORDER BY created_at DESC LIMIT $2',
            [taskId, limit]
        );
        return rows;
    },

    async getEntityJourney(entityType, entityId) {
        // Get all workflow instances for this entity
        const instances = await this.getInstances({ entity_type: entityType, entity_id: entityId });
        const journey = [];

        for (const inst of instances) {
            const tasks = await this.getTasks({ workflow_instance_id: inst.id });
            journey.push({ ...inst, tasks });
        }
        return journey;
    },

    // ===================== STANDALONE TASKS =====================
    async createStandaloneTask(data) {
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + (data.sla_hours || 24));

        const steps = (data.steps || []).map((s, i) => ({
            order: i + 1,
            name: typeof s === 'string' ? s : s.name,
            completed: false
        }));

        const { rows } = await pool.query(
            `INSERT INTO wf_tasks (title, description, domain, priority, assignee_id, assignee_name,
                entity_type, entity_id, entity_name, steps, steps_total, sla_hours, deadline, status, assigned_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
            [data.title, data.description, data.domain, data.priority || 'medium',
             data.assignee_id, data.assignee_name, data.entity_type, data.entity_id, data.entity_name,
             JSON.stringify(steps), steps.length, data.sla_hours || 24, deadline,
             data.assignee_id ? 'assigned' : 'pending', data.assigned_by]
        );

        await pool.query(
            `INSERT INTO wf_task_activity (task_id, action, actor_name) VALUES ($1,'created',$2)`,
            [rows[0].id, 'Manual']
        );

        return rows[0];
    },

    // Get employees list for assignment
    async getEmployees(department = null) {
        let sql = `SELECT id, employee_name, department, personal_phone, business_phone, status
                   FROM clickup_employees_901202229372 WHERE is_deleted = false AND status = 'on duty'`;
        const params = [];
        if (department) { sql += ' AND department ILIKE $1'; params.push(`%${department}%`); }
        sql += ' ORDER BY employee_name';
        const { rows } = await pool.query(sql, params);
        return rows;
    }
};

module.exports = WorkflowEngine;
