require('dotenv').config({ path: __dirname + '/../.env' });
const pool = require('../db');

async function seed() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if already seeded
        const { rows: existing } = await client.query('SELECT COUNT(*) as count FROM wf_templates');
        if (parseInt(existing[0].count) > 0) {
            console.log('[SEED] Templates already exist, skipping seed');
            await client.query('ROLLBACK');
            return;
        }

        // ========================
        // SALES TEMPLATES
        // ========================
        const salesTemplates = [
            {
                name: 'Qualify Lead', domain: 'sales', description: 'Initial lead qualification and assessment',
                sla: 24, priority: 'high', assignee_rule: 'department', assignee_dept: 'Sales',
                steps: ['Review lead source', 'Contact customer', 'Confirm requirements', 'Assess feasibility', 'Update lead status']
            },
            {
                name: 'Site Survey', domain: 'sales', description: 'Physical site survey for service delivery',
                sla: 48, priority: 'high', assignee_rule: 'department', assignee_dept: 'Technicians R1',
                steps: ['Schedule survey date', 'Visit site', 'Check fiber availability', 'Take photos', 'Submit survey report', 'Update coverage map']
            },
            {
                name: 'Send Proposal', domain: 'sales', description: 'Prepare and send pricing proposal to customer',
                sla: 24, priority: 'high', assignee_rule: 'department', assignee_dept: 'Sales',
                steps: ['Calculate pricing', 'Prepare proposal document', 'Internal review', 'Send to customer', 'Log in CRM']
            },
            {
                name: 'Negotiate Deal', domain: 'sales', description: 'Handle customer negotiations and close the deal',
                sla: 72, priority: 'medium', assignee_rule: 'department', assignee_dept: 'Sales',
                steps: ['Review customer counter-offer', 'Internal approval for discounts', 'Final proposal', 'Get signed contract', 'Mark as Won/Lost']
            },
        ];

        // ========================
        // CIRCUITS TEMPLATES
        // ========================
        const circuitTemplates = [
            {
                name: 'Create Billing', domain: 'circuits', description: 'Set up billing for new circuit',
                sla: 24, priority: 'high', assignee_rule: 'department', assignee_dept: 'Finance',
                steps: ['Create invoice in billing system', 'Set MRC amount', 'Set NRC amount', 'Configure billing cycle', 'Confirm with customer']
            },
            {
                name: 'Install Devices', domain: 'circuits', description: 'Physical installation of network equipment',
                sla: 48, priority: 'urgent', assignee_rule: 'department', assignee_dept: 'Technicians R1',
                steps: ['Check inventory for devices', 'Schedule installation date', 'Travel to site', 'Install router/ONT', 'Cable management', 'Power up devices', 'Take photo proof']
            },
            {
                name: 'Configure Circuit', domain: 'circuits', description: 'Technical configuration of the circuit',
                sla: 24, priority: 'high', assignee_rule: 'department', assignee_dept: 'IT',
                steps: ['Configure IP addressing', 'Set up VLAN', 'Configure routing', 'Set bandwidth limits', 'Enable monitoring']
            },
            {
                name: 'Test Circuit', domain: 'circuits', description: 'End-to-end testing of the circuit',
                sla: 24, priority: 'high', assignee_rule: 'department', assignee_dept: 'IT',
                steps: ['Ping test', 'Speed test', 'Latency test', 'Failover test', 'Customer confirmation', 'Update MRTG']
            },
            {
                name: 'Activate Circuit', domain: 'circuits', description: 'Final activation and handover to customer',
                sla: 12, priority: 'urgent', assignee_rule: 'department', assignee_dept: 'Coordination',
                steps: ['Confirm all tests passed', 'Notify customer', 'Update circuit status to Active', 'Send welcome email', 'Close activation ticket']
            },
            {
                name: 'Stop Billing', domain: 'circuits', description: 'Stop billing for deactivated circuit',
                sla: 24, priority: 'high', assignee_rule: 'department', assignee_dept: 'Finance',
                steps: ['Calculate final invoice', 'Stop recurring billing', 'Issue final bill', 'Confirm with customer']
            },
            {
                name: 'Dismantle Equipment', domain: 'circuits', description: 'Remove equipment from customer site',
                sla: 48, priority: 'medium', assignee_rule: 'department', assignee_dept: 'Technicians R1',
                steps: ['Schedule dismantle date', 'Travel to site', 'Remove router/ONT', 'Remove cabling', 'Take photo proof', 'Transport to warehouse']
            },
            {
                name: 'Return Equipment', domain: 'circuits', description: 'Process equipment return to stock',
                sla: 24, priority: 'low', assignee_rule: 'department', assignee_dept: 'Stock',
                steps: ['Inspect equipment condition', 'Update inventory', 'Store in warehouse', 'Update asset records']
            },
        ];

        // ========================
        // MARKETING TEMPLATES
        // ========================
        const marketingTemplates = [
            {
                name: 'Design Campaign', domain: 'marketing', description: 'Create marketing campaign materials',
                sla: 48, priority: 'medium', assignee_rule: 'department', assignee_dept: 'Marketing',
                steps: ['Define target audience', 'Create campaign brief', 'Design visuals', 'Write copy', 'Internal review']
            },
            {
                name: 'Approve Campaign', domain: 'marketing', description: 'Manager approval for campaign launch',
                sla: 24, priority: 'high', assignee_rule: 'department', assignee_dept: 'Management',
                steps: ['Review campaign brief', 'Check budget', 'Approve/Reject', 'Schedule launch date']
            },
            {
                name: 'Launch Campaign', domain: 'marketing', description: 'Execute campaign launch across channels',
                sla: 24, priority: 'urgent', assignee_rule: 'department', assignee_dept: 'Marketing',
                steps: ['Prepare all channels', 'Send WhatsApp blasts', 'Post on social media', 'Start field teams', 'Monitor initial response']
            },
            {
                name: 'Field Survey', domain: 'marketing', description: 'On-ground survey at target location',
                sla: 48, priority: 'medium', assignee_rule: 'department', assignee_dept: 'Marketing',
                steps: ['Travel to location', 'Conduct door-to-door survey', 'Collect contact details', 'Record GPS coordinates', 'Submit survey data', 'Upload photos']
            },
            {
                name: 'Collect Results', domain: 'marketing', description: 'Compile campaign results and create report',
                sla: 72, priority: 'medium', assignee_rule: 'department', assignee_dept: 'Marketing',
                steps: ['Gather all survey data', 'Count qualified leads', 'Calculate conversion metrics', 'Create report', 'Feed leads to Sales']
            },
        ];

        // ========================
        // HR TEMPLATES
        // ========================
        const hrTemplates = [
            {
                name: 'Process Iqama', domain: 'hr', description: 'Handle iqama processing for new/renewal',
                sla: 72, priority: 'high', assignee_rule: 'department', assignee_dept: 'HR',
                steps: ['Collect required documents', 'Submit to GOSI', 'Pay fees', 'Receive iqama', 'Update employee records', 'Deliver to employee']
            },
            {
                name: 'Setup Insurance', domain: 'hr', description: 'Medical insurance enrollment',
                sla: 48, priority: 'high', assignee_rule: 'department', assignee_dept: 'HR',
                steps: ['Get employee details', 'Submit to insurance provider', 'Receive policy number', 'Issue insurance card', 'Update records']
            },
            {
                name: 'Open Bank Account', domain: 'hr', description: 'Set up employee bank account for salary',
                sla: 72, priority: 'medium', assignee_rule: 'department', assignee_dept: 'HR',
                steps: ['Collect required documents', 'Submit bank application', 'Follow up with bank', 'Receive account details', 'Update payroll records']
            },
            {
                name: 'Issue Equipment', domain: 'hr', description: 'Provide work equipment to employee',
                sla: 24, priority: 'medium', assignee_rule: 'department', assignee_dept: 'Stock',
                steps: ['Check equipment availability', 'Prepare equipment list', 'Get manager approval', 'Issue from stock', 'Employee signs receipt', 'Update asset records']
            },
            {
                name: 'Employee Orientation', domain: 'hr', description: 'New employee orientation and training',
                sla: 48, priority: 'medium', assignee_rule: 'department', assignee_dept: 'HR',
                steps: ['Welcome and introduction', 'Office tour', 'Safety briefing', 'System access setup', 'Assign mentor', 'First week plan']
            },
            {
                name: 'Renew Iqama', domain: 'hr', description: 'Auto-generated iqama renewal task',
                sla: 168, priority: 'urgent', assignee_rule: 'department', assignee_dept: 'HR',
                steps: ['Check expiry date', 'Prepare renewal documents', 'Submit renewal', 'Pay renewal fees', 'Receive renewed iqama', 'Update records']
            },
            {
                name: 'Renew Insurance', domain: 'hr', description: 'Auto-generated insurance renewal task',
                sla: 168, priority: 'high', assignee_rule: 'department', assignee_dept: 'HR',
                steps: ['Review current policy', 'Get renewal quote', 'Approve renewal', 'Process payment', 'Receive new policy', 'Update records']
            },
            {
                name: 'Process Vacation', domain: 'hr', description: 'Handle vacation request',
                sla: 48, priority: 'medium', assignee_rule: 'department', assignee_dept: 'HR',
                steps: ['Receive request', 'Check leave balance', 'Get manager approval', 'Update leave records', 'Notify employee', 'Update calendar']
            },
            {
                name: 'Process Overtime', domain: 'hr', description: 'Handle overtime approval and payment',
                sla: 48, priority: 'medium', assignee_rule: 'department', assignee_dept: 'HR',
                steps: ['Receive overtime form', 'Verify hours', 'Get manager approval', 'Calculate payment', 'Add to payroll', 'Notify employee']
            },
        ];

        // Insert all templates
        const allTemplates = [...salesTemplates, ...circuitTemplates, ...marketingTemplates, ...hrTemplates];
        const templateIds = {};

        for (const t of allTemplates) {
            const { rows: [row] } = await client.query(
                `INSERT INTO wf_templates (name, domain, description, default_sla_hours, assignee_rule, assignee_department, steps, priority)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, name`,
                [t.name, t.domain, t.description, t.sla, t.assignee_rule, t.assignee_dept,
                 JSON.stringify(t.steps.map((s, i) => ({ name: s, order: i + 1 }))), t.priority]
            );
            templateIds[t.name] = row.id;
            console.log(`  Template: ${t.name} (id: ${row.id})`);
        }

        // ========================
        // WORKFLOW DEFINITIONS
        // ========================
        const workflows = [
            {
                name: 'Sales Pipeline', domain: 'sales',
                description: 'Full sales cycle from lead to close',
                trigger_type: 'manual',
                stages: [
                    { order: 1, template_id: templateIds['Qualify Lead'], wait_for_previous: false },
                    { order: 2, template_id: templateIds['Site Survey'], wait_for_previous: true },
                    { order: 3, template_id: templateIds['Send Proposal'], wait_for_previous: true },
                    { order: 4, template_id: templateIds['Negotiate Deal'], wait_for_previous: true },
                ]
            },
            {
                name: 'Circuit Activation', domain: 'circuits',
                description: 'Activate a new circuit from billing to going live',
                trigger_type: 'manual',
                stages: [
                    { order: 1, template_id: templateIds['Create Billing'], wait_for_previous: false },
                    { order: 2, template_id: templateIds['Install Devices'], wait_for_previous: true },
                    { order: 3, template_id: templateIds['Configure Circuit'], wait_for_previous: true },
                    { order: 4, template_id: templateIds['Test Circuit'], wait_for_previous: true },
                    { order: 5, template_id: templateIds['Activate Circuit'], wait_for_previous: true },
                ]
            },
            {
                name: 'Circuit Deactivation', domain: 'circuits',
                description: 'Deactivate and dismantle a circuit',
                trigger_type: 'manual',
                stages: [
                    { order: 1, template_id: templateIds['Stop Billing'], wait_for_previous: false },
                    { order: 2, template_id: templateIds['Dismantle Equipment'], wait_for_previous: true },
                    { order: 3, template_id: templateIds['Return Equipment'], wait_for_previous: true },
                ]
            },
            {
                name: 'Marketing Campaign', domain: 'marketing',
                description: 'Full marketing campaign lifecycle',
                trigger_type: 'manual',
                stages: [
                    { order: 1, template_id: templateIds['Design Campaign'], wait_for_previous: false },
                    { order: 2, template_id: templateIds['Approve Campaign'], wait_for_previous: true },
                    { order: 3, template_id: templateIds['Launch Campaign'], wait_for_previous: true },
                    { order: 4, template_id: templateIds['Field Survey'], wait_for_previous: true },
                    { order: 5, template_id: templateIds['Collect Results'], wait_for_previous: true },
                ]
            },
            {
                name: 'Employee Onboarding', domain: 'hr',
                description: 'Complete onboarding for new employee',
                trigger_type: 'manual',
                stages: [
                    { order: 1, template_id: templateIds['Process Iqama'], wait_for_previous: false },
                    { order: 2, template_id: templateIds['Setup Insurance'], wait_for_previous: true },
                    { order: 3, template_id: templateIds['Open Bank Account'], wait_for_previous: true },
                    { order: 4, template_id: templateIds['Issue Equipment'], wait_for_previous: true },
                    { order: 5, template_id: templateIds['Employee Orientation'], wait_for_previous: true },
                ]
            },
        ];

        for (const wf of workflows) {
            const { rows: [row] } = await client.query(
                `INSERT INTO wf_workflow_definitions (name, domain, description, trigger_type, stages)
                 VALUES ($1,$2,$3,$4,$5) RETURNING id`,
                [wf.name, wf.domain, wf.description, wf.trigger_type, JSON.stringify(wf.stages)]
            );
            console.log(`  Workflow: ${wf.name} (id: ${row.id})`);
        }

        await client.query('COMMIT');
        console.log(`\n[SEED] Done: ${allTemplates.length} templates, ${workflows.length} workflows`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[SEED] Error:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(err => { console.error(err); process.exit(1); });
