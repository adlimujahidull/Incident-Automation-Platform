# Demo Flow

This document is the demo planning script for the Incident Management System.

All mandatory RPA requirements (Drive/email-export source, TXT/PDF/DOCX extraction, 14-day hash duplicate skip, screenshot-on-failure, summary email with totals) are now implemented and safe to demo. The remaining work is recording the actual screenshots and 10-12 minute video.

Use this script to walk through the implemented system end to end.

## Demo Goal

Show that the platform can take a messy incident report, turn it into a structured incident, support reviewer workflow, and prove UiPath integration through jobs/logs.

The final 10-12 minute video must cover:

- login and protected access
- incident upload/intake
- incident viewer search/filter
- API CRUD behavior
- workflow status and history
- dashboard reporting
- UiPath automation design and execution
- RPA duplicate handling
- RPA failure handling with logs and screenshot
- RPA summary email
- AI triage suggestions

## Current Demo Baseline

Safe to demonstrate now (all mandatory items live):

- login as seeded users
- dashboard overview with KPIs, workflow, source/category panels, automation health
- manual incident creation with "Auto-fill from selected PDF/DOCX/TXT" extraction
- file staging/upload validation (PDF/DOCX/PNG/JPG/JPEG/TXT)
- incident register with tag chips, creator substring, status/priority/category/department/source filters
- assignment/status workflow + comments + timeline
- AI triage panel (NVIDIA NIM / DeepSeek live or heuristic fallback)
- audit-safe DELETE via the Archive button on the incident detail page (Admin only)
- UiPath Drive-folder watcher that ingests TXT/PDF/DOCX/PNG/JPG
- 14-day hash duplicate skip via `POST /api/uipath/duplicate-check`
- screenshot-on-failure uploaded as evidence and attached to failure callback
- summary email sent via SMTP (or recorded server-side when SMTP is not configured)
- UiPath job and automation log pages with the new `RUN_SUMMARY_EMAIL` and `DUPLICATE_SKIPPED` event types

Open items are evidence-only (capture screenshots, record the video).

## Prerequisites

1. Start PostgreSQL:

```bash
docker compose up -d
```

2. Configure backend environment from `backend/.env.example`.

Required values:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `UIPATH_SHARED_SECRET`

Optional live AI values:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

3. Reset demo data if needed:

```bash
cd backend
npm run db:reset-dev
```

4. Start backend and frontend:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

5. Open the frontend at `http://localhost:5173`.

## Demo Accounts

All seeded users use the default password `Passw0rd!` unless `DEFAULT_DEMO_PASSWORD` was changed.

| Role | Email | Demo use |
| --- | --- | --- |
| Admin | `admin.ops@dhl.local` | Full visibility and settings |
| Reviewer | `reviewer.ops@dhl.local` | Triage and workflow decisions |
| Support Staff | `support.ops@dhl.local` | Incident intake |

## Recommended Demo Script

### Step 1: Login

- Open `http://localhost:5173`.
- Login as Admin.
- Show protected navigation and role-aware workspace.

### Step 2: Dashboard

- Open dashboard.
- Show KPI cards, workflow distribution, priority/category/source breakdowns, workload, trends, and automation activity.
- Explain that the dashboard should reflect database data, not hardcoded cards.

### Step 3: Incident Viewer

- Open `/incidents`.
- Demonstrate keyword search, date range, status chips, priority/category/department chips, and source chips.
- Demonstrate **tag chips** by adding `damage` or `late-delivery` to the Tags input.
- Demonstrate **creator filter** by typing part of an actor email/name (e.g. `support`, `uipath`).
- Open an incident detail page.

### Step 4: Manual Intake With Extraction

- Login as Support Staff or use an allowed intake role.
- Open `/incidents/new`.
- Upload a real PDF or DOCX evidence file (PDF/DOCX/PNG/JPG/JPEG/TXT all accepted).
- Click the "Auto-fill from selected PDF/DOCX/TXT" button on the draft panel.
- Show the populated title, summary, category, priority, department, tags, suggested action and the expandable extracted-text preview.
- Adjust any field manually and submit. The incident is created with the staged file linked.

### Step 5: AI Triage

- Open the incident detail page.
- Run AI analysis.
- Show suggested title, summary, category, priority, department, tags, action, or duplicate candidate.
- Apply one suggestion as a reviewer/admin if permissions allow.
- Show history entry proving the action was recorded.

### Step 6: Reviewer Workflow

- Login as Reviewer.
- Assign the incident.
- Move it through a valid status transition.
- Add a comment or operational note.
- Show the timeline/history page.

### Step 7: API CRUD Evidence

Show API examples in the report or demo:

- `GET /api/incidents` (also show `?tags=damage&creator=support` for the tag/creator filters)
- `GET /api/incidents/:id`
- `POST /api/incidents`
- `PUT /api/incidents/:id`
- `PATCH /api/incidents/:id/status`
- `POST /api/uploads` and `POST /api/uploads/:id/extract`
- `DELETE /api/incidents/:id` â€” audit-safe archive endpoint. Trigger via the Archive Incident panel; confirm the incident shows status `REJECTED`, tag `archived`, and a `INCIDENT_ARCHIVED` row in history. Explain that hard deletion is intentionally avoided to preserve operational audit history.

### Step 8: UiPath End-to-End Run (Drive folder â†’ Incident)

- Open UiPath Studio and load `rpa/DhlIncidentBot/project.json`.
- Confirm variables: `InputFolder` (points at a Drive sync folder for the demo), `ApiBaseUrl`, `SharedSecret`, `ProcessName`, `AdminEmail`, optional `SmtpHost`.
- Drop a real PDF or DOCX complaint into `Data\Input`.
- Run the bot.
- Show the new job in `/uipath-jobs`, with the source file attached as an RPA-staged evidence record.
- Open `/automation-logs` and point out the `JOB_RECEIVED` â†’ `INCIDENT_CREATED` â†’ `JOB_COMPLETED` chain plus the new `RUN_SUMMARY_EMAIL` entry.
- Open the created incident â€” show that the extracted text became the summary, the tags include `rpa-intake`, and the source PDF/DOCX is downloadable from the evidence section.

### Step 9: Duplicate, Failure, and Summary Email

- Re-drop the **same** file into `Data\Input` and re-run. The bot should skip it (logged as duplicate) and move it to `Data\Duplicate`. The `processed_hashes` table proves the 14-day rule.
- Force a failure by dropping a corrupt or zero-byte file. Show that the bot:
  - takes a screenshot saved to `Data\Logs\failure-*.png`
  - uploads that screenshot via `POST /api/uipath/uploads` and patches the failure callback with the attachment id (visible in the UiPath job drawer)
  - moves the file to `Data\Failed`
- After the run, point to `Data\Logs\run-*.log` and the `RUN_SUMMARY_EMAIL` entry in `/automation-logs` with the totals payload.
- If `SmtpHost` is set, show the email landing in the local mail catcher with the log attached. Otherwise read the server-side summary record.

### Step 10: Wrap-Up

- Return to dashboard.
- Show incident count/workload updated.
- Show automation activity updated.
- Summarize the end-to-end story from raw input to reviewer resolution.

## Screenshot Checklist

Capture these for the report:

- login page
- dashboard
- incident register with filters
- manual intake/upload page
- incident detail with workflow controls
- AI triage panel
- incident timeline/history
- automation logs page
- UiPath jobs page
- UiPath Studio workflow
- UiPath run output
- file moved to Processed/Failed
- duplicate skip evidence
- failure screenshot evidence
- summary email
- API request/response examples

## Talking Points

- "UiPath is a first-class ingestion channel, not a decorative add-on."
- "AI suggestions are reviewer-controlled and stored separately from final incident fields."
- "Every workflow action is auditable through incident history."
- "Duplicate handling must satisfy the 14-day hash rule from the assignment."
- "The dashboard summarizes operational workload for management reporting."
- "If deletion is restricted, that is an auditability decision and must be explained clearly."

## Reset Between Demos

```bash
cd backend
npm run db:reset-dev
```

After reset, re-run any UiPath sample needed for fresh automation evidence.
