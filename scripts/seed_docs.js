require('dotenv').config({ path: __dirname + '/../.env' });
const pool = require('../db');

const sections = [
    {
        key: 'overview', title: 'System Overview', order: 1,
        content: `# Business RAG ERP — Full ClickUp Replacement

**Port:** 6007 | **Database:** business_rag (shared with Business RAG Admin on 6006)

## Purpose
ClickUp is generic. This system knows YOUR business rules, enforces deadlines, punishes delays, rewards performance, and automates notifications. It replaces ClickUp entirely — existing data is already imported, we build forward from here.

## Architecture (3 Layers)

**Templates** → Define HOW work is done once (reusable micro-tasks with steps, SLA, assignee rules)
**Workflows** → Chain templates into sequences (e.g., Billing → Install → Activate)
**Engine** → Assigns, tracks, reminds (WhatsApp), penalizes, reports

## Status: IMPLEMENTED ✓`
    },
    {
        key: 'views', title: '3 Views', order: 2,
        content: `# 3 Views

## 1. Bird's Eye (Manager War Room) ✓
- Single screen, 4 domain cards: **Sales | Circuits | Marketing | HR**
- Each card: active count, overdue count, completion rate, revenue at risk
- Click a card → drill into domain detail
- Click any workflow → opens its Journey Map
- Global stats row: total active, overdue, completed, circuits count, leads count, employees count
- Recent activity feed at the bottom

## 2. Journey Map (Per Entity) ✓
- Horizontal timeline of a circuit/lead/employee process
- Each step shows: assignee, SLA, status, time remaining
- Color-coded dots: green (completed), blue (active/pulsing), red (overdue), gray (pending)
- Activity feed below: who did what, when
- Click any stage card to open task detail

## 3. My Tasks (Employee Personal View) ✓
- List view + Kanban toggle
- Each task: title, deadline countdown, checklist steps, priority badge (color bar)
- Personal stats bar: tasks completed, on-time rate, current streak, avg completion hours
- Task detail modal with step checklist, assignment, start/complete/cancel actions
- Kanban columns: Pending → Assigned → In Progress → Overdue → Completed
- Filters: domain, status`
    },
    {
        key: 'roles', title: 'Roles & Permissions', order: 3,
        content: `# Roles & Permissions

| Capability | Manager (owner/admin) | Employee (user) |
|------------|----------------------|-----------------|
| Bird's Eye (all domains) | ✓ Yes | Own domain only |
| See all employees' tasks | ✓ Yes | No |
| Penalties & deductions | Full control | Hidden |
| Performance of others | ✓ Yes (leaderboard) | Own stats only |
| Create templates/workflows | ✓ Yes | No |
| Start/reassign workflows | ✓ Yes | No |
| Complete tasks | Any task | Own tasks only |
| Admin tab | ✓ Visible | Hidden |
| Edit documentation | ✓ Yes | View only |

## Current Users
- **erpadmin** (owner) — password: admin123
- Employees are auto-assigned from the clickup_employees table based on department

## Status: IMPLEMENTED ✓`
    },
    {
        key: 'domains', title: 'The 4 Domains', order: 4,
        content: `# The 4 Domains

## Sales (CRM) ✓
- **Data source:** clickup_crm_isp_900900441979 (1905 leads)
- **Workflow:** Sales Pipeline — Qualify → Site Survey → Send Proposal → Negotiate
- **Templates:** Qualify Lead (24h), Site Survey (48h), Send Proposal (24h), Negotiate (72h)
- **Tracks:** pipeline funnel, conversion rate, per-salesperson performance

## Circuits (Layer3 + DSP) ✓
- **Data source:** clickup_layer3_circuits_900902010182 (1152 circuits) + clickup_dsp_circuits_900400290457
- **Activation Workflow:** Create Billing → Install Devices → Configure → Test → Activate
- **Deactivation Workflow:** Stop Billing → Dismantle Equipment → Return Equipment
- **Templates:** 8 circuit templates with field-specific steps

## Marketing ✓
- **Workflow:** Marketing Campaign — Design → Approve → Launch → Field Survey → Collect Results
- **Templates:** 5 marketing templates
- **Survey tasks** with GPS coordinates support
- **Output:** Qualified leads feed into Sales pipeline

## HR ✓
- **Data source:** clickup_employees_901202229372 (83 active employees)
- **Onboarding Workflow:** Process Iqama → Setup Insurance → Open Bank Account → Issue Equipment → Employee Orientation
- **Renewal templates:** Renew Iqama (168h), Renew Insurance (168h)
- **Additional:** Process Vacation (48h), Process Overtime (48h)
- **Linked tables:** iqamas, medical_insurance, passports, driving_license, cars, certificates

## Status: ALL 4 DOMAINS IMPLEMENTED ✓`
    },
    {
        key: 'templates', title: 'Template System', order: 5,
        content: `# Reusable Template System

Each template is defined ONCE with:
- **Steps checklist** (e.g., Install Devices: Check inventory → Schedule → Install → Test → Photo proof)
- **Default SLA** (hours to complete)
- **Assignee rule** (manual, by department, by role, round-robin)
- **Domain** (sales/circuits/marketing/hr)
- **Priority** (low/medium/high/urgent)

When a workflow starts, the system creates fresh task copies from templates, auto-assigns them based on rules, sets deadlines, and starts the clock.

## 26 Templates Implemented ✓

| # | Template | Domain | SLA | Assignee Rule |
|---|----------|--------|-----|---------------|
| 1 | Qualify Lead | sales | 24h | Sales dept |
| 2 | Site Survey | sales | 48h | Technicians R1 |
| 3 | Send Proposal | sales | 24h | Sales dept |
| 4 | Negotiate Deal | sales | 72h | Sales dept |
| 5 | Create Billing | circuits | 24h | Finance dept |
| 6 | Install Devices | circuits | 48h | Technicians R1 |
| 7 | Configure Circuit | circuits | 24h | IT dept |
| 8 | Test Circuit | circuits | 24h | IT dept |
| 9 | Activate Circuit | circuits | 12h | Coordination |
| 10 | Stop Billing | circuits | 24h | Finance dept |
| 11 | Dismantle Equipment | circuits | 48h | Technicians R1 |
| 12 | Return Equipment | circuits | 24h | Stock dept |
| 13 | Design Campaign | marketing | 48h | Marketing dept |
| 14 | Approve Campaign | marketing | 24h | Management |
| 15 | Launch Campaign | marketing | 24h | Marketing dept |
| 16 | Field Survey | marketing | 48h | Marketing dept |
| 17 | Collect Results | marketing | 72h | Marketing dept |
| 18 | Process Iqama | hr | 72h | HR dept |
| 19 | Setup Insurance | hr | 48h | HR dept |
| 20 | Open Bank Account | hr | 72h | HR dept |
| 21 | Issue Equipment | hr | 24h | Stock dept |
| 22 | Employee Orientation | hr | 48h | HR dept |
| 23 | Renew Iqama | hr | 168h | HR dept |
| 24 | Renew Insurance | hr | 168h | HR dept |
| 25 | Process Vacation | hr | 48h | HR dept |
| 26 | Process Overtime | hr | 48h | HR dept |

## 5 Workflow Chains ✓

| Workflow | Domain | Stages |
|----------|--------|--------|
| Sales Pipeline | sales | 4 stages |
| Circuit Activation | circuits | 5 stages |
| Circuit Deactivation | circuits | 3 stages |
| Marketing Campaign | marketing | 5 stages |
| Employee Onboarding | hr | 5 stages |`
    },
    {
        key: 'enforcement', title: 'Enforcement System', order: 6,
        content: `# Enforcement System

## WhatsApp Reminders (automatic) ✓
- **Task assigned** → immediate notification with details + deadline
- **50% SLA elapsed** → gentle reminder
- **80% SLA elapsed** → urgent warning
- **Deadline passed** → overdue alert to employee + their manager
- Notifications are queued in wf_notifications table
- Deduplication: same notification type won't re-send within 4 hours

## SLA Tracker ✓
- Background scanner runs every 5 minutes
- Checks all active tasks with deadlines
- Automatically marks tasks as "overdue" when deadline passes
- Logs activity for audit trail

## Penalties (auto-generated, manager-approved) ✓
- Overdue < 24h → **50 SAR**
- Overdue 1–3 days → **150 SAR**
- Overdue > 3 days → **300 SAR**
- Cancelled while overdue → **500 SAR**
- Manager can **approve** or **waive** each penalty from Admin panel
- Penalties auto-upgrade (50→150→300 as delay grows)
- Links to payroll period for deduction tracking
- Employee total penalties tracked in wf_employee_stats

## Status: IMPLEMENTED ✓`
    },
    {
        key: 'database', title: 'Database Schema', order: 7,
        content: `# Database Schema

## ERP Tables (wf_*)

| Table | Purpose |
|-------|---------|
| wf_templates | 26 reusable task blueprints |
| wf_workflow_definitions | 5 workflow chains (stages referencing templates) |
| wf_workflow_instances | Running workflow instances linked to entities |
| wf_tasks | Individual work items with checklists, deadlines, assignments |
| wf_task_activity | Audit log: who did what, when |
| wf_penalties | Auto-generated penalty records |
| wf_notifications | WhatsApp message queue |
| wf_employee_stats | Aggregated performance per employee |
| wf_documentation | This documentation (editable) |

## Shared Tables (from Business RAG Admin)

| Table | Data |
|-------|------|
| system_users | Authentication & roles |
| system_http_sessions | Session storage |
| clickup_employees_901202229372 | 83 employees (name, dept, phone) |
| clickup_layer3_circuits_900902010182 | 1152 L3 circuits |
| clickup_dsp_circuits_900400290457 | DSP circuits |
| clickup_crm_isp_900900441979 | 1905 CRM leads |
| clickup_iqamas_ids_and_visit_permissions_901202363390 | Iqama records |
| clickup_medical_insurance_901202363410 | Insurance records |
| clickup_passports_901202363391 | Passport records |
| clickup_driving_license_901202363392 | Driving licenses |
| clickup_vacations_901203558060 | Vacation records |
| clickup_overtime_form_901203883335 | Overtime records |
| clickup_certificates_901203148687 | Certificates |

## Status: IMPLEMENTED ✓`
    },
    {
        key: 'api', title: 'API Endpoints', order: 8,
        content: `# API Endpoints

All endpoints require authentication (session cookie). Manager = owner/admin role.

## Auth
- POST /api/auth/login — Login (username, password)
- POST /api/auth/logout — Logout
- GET /api/auth/me — Current user info

## Templates
- GET /api/templates?domain= — List templates
- GET /api/templates/:id — Get template
- POST /api/templates — Create template (manager)
- PUT /api/templates/:id — Update template (manager)

## Workflows
- GET /api/workflows/definitions — List workflow definitions
- GET /api/workflows/definitions/:id — Get definition
- POST /api/workflows/definitions — Create definition (manager)
- POST /api/workflows/start — Start workflow instance (manager)
- GET /api/workflows/instances?status=&domain= — List instances
- GET /api/workflows/instances/:id — Get instance with tasks
- GET /api/workflows/journey/:entityType/:entityId — Entity journey
- GET /api/workflows/employees?department= — Employee list

## Tasks
- GET /api/tasks?status=&domain=&assignee_id= — List tasks
- GET /api/tasks/mine — My assigned tasks
- GET /api/tasks/:id — Task detail + activity
- POST /api/tasks — Create standalone task
- POST /api/tasks/:id/assign — Assign task (manager)
- POST /api/tasks/:id/start — Start task
- POST /api/tasks/:id/step/:order — Complete a checklist step
- POST /api/tasks/:id/complete — Complete task
- POST /api/tasks/:id/cancel — Cancel task (manager)

## Dashboard
- GET /api/dashboard/stats — Bird's Eye stats (4 domains)
- GET /api/dashboard/domain/:domain — Domain detail
- GET /api/dashboard/leaderboard — Employee leaderboard
- GET /api/dashboard/my-stats — Personal stats
- GET /api/dashboard/entity-counts — Circuit/lead/employee counts
- GET /api/dashboard/activity — Recent activity feed
- GET /api/dashboard/leads — CRM leads list
- GET /api/dashboard/circuits — L3 circuits list
- GET /api/dashboard/dsp-circuits — DSP circuits list
- GET /api/dashboard/notifications — Notification queue

## Penalties
- GET /api/penalties?status=&employee_id= — List penalties
- GET /api/penalties/summary — Summary by employee
- POST /api/penalties/:id/approve — Approve penalty (manager)
- POST /api/penalties/:id/waive — Waive penalty (manager)

## Documentation
- GET /api/docs — All documentation sections
- POST /api/docs — Create section (manager)
- PUT /api/docs/:id — Update section (manager)
- DELETE /api/docs/:id — Delete section (manager)

## Status: ALL ENDPOINTS IMPLEMENTED ✓`
    },
    {
        key: 'tech', title: 'Technical Stack', order: 9,
        content: `# Technical Stack

## Server
- **Runtime:** Node.js v20
- **Framework:** Express.js
- **Port:** 6007
- **Session:** express-session + connect-pg-simple (PostgreSQL-backed)
- **Auth:** bcrypt password hashing

## Database
- **PostgreSQL** (shared database: business_rag, user: raguser)
- 9 ERP-specific tables (wf_* prefix)
- Shares employee, circuit, CRM, HR tables with Business RAG Admin

## Frontend
- Single-page application (vanilla HTML/CSS/JS)
- No build step, no framework dependencies
- Dark theme UI with responsive design
- Modals for task detail, creation, assignment

## Background Services
- **SLA Tracker:** Scans every 5 minutes for deadline breaches
- **Penalty Engine:** Auto-generates penalties based on overdue duration
- **Notification Service:** Queues WhatsApp messages with deduplication

## Project Structure
\`\`\`
business-rag-erp/
├── server.js              # Express server
├── db.js                  # PostgreSQL pool
├── package.json
├── .env                   # Config (not in git)
├── scripts/
│   ├── create_workflow_tables.js   # DB migration
│   └── seed_templates.js           # Seed 26 templates + 5 workflows
├── services/
│   ├── workflow-engine.js          # Core engine
│   ├── sla-tracker.js              # Background deadline scanner
│   ├── penalty-engine.js           # Penalty rules
│   └── workflow-notifications.js   # WhatsApp queue
├── routes/
│   ├── auth.js, templates.js, workflows.js
│   ├── tasks.js, dashboard.js, penalties.js
│   └── docs.js
└── public/
    ├── index.html          # Main SPA
    └── login.html          # Login page
\`\`\`

## Status: IMPLEMENTED ✓`
    }
];

async function seed() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const s of sections) {
            await client.query(
                `INSERT INTO wf_documentation (section_key, title, content, sort_order, updated_by)
                 VALUES ($1, $2, $3, $4, 'System')
                 ON CONFLICT (section_key) DO UPDATE SET title = $2, content = $3, sort_order = $4, updated_at = NOW()`,
                [s.key, s.title, s.content, s.order]
            );
            console.log(`  Doc: ${s.title}`);
        }
        await client.query('COMMIT');
        console.log(`\n[SEED] ${sections.length} documentation sections created`);
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
