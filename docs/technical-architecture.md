# Technical Architecture

This document defines the current and target architecture for the Incident Automation Platform.

Keep this document aligned with the implemented system.

## Target System Flow

```text
Raw incident sources
(email, Drive folder, chat export, call note, PDF, DOCX, TXT, image)
        |
        v
UiPath RPA layer
(extract, hash duplicate check, upload evidence, create/update incident, log, screenshot, email summary)
        |
        v
Backend REST API
(auth, validation, CRUD, workflow, uploads, dashboard, UiPath bridge)
        |
        v
AI triage service
(title, summary, category, priority, department, duplicate suggestion)
        |
        v
PostgreSQL database
(users, incidents, attachments, history, AI analyses, UiPath jobs, automation logs)
        |
        v
Vue operations dashboard
(intake, viewer, filters, detail, timeline, dashboard, automation review)
        |
        v
Human reviewer
(assignment, verification, resolution, reporting)
```

## Current Implementation Baseline

Frontend:

- Vue 3, Vite, Vue Router, Pinia, Axios
- login and protected routes
- role-aware sidebar/navigation
- dashboard widgets
- incident register and detail views
- intake page with evidence staging
- workflow actions, assignment, comments, and timeline
- AI triage panel
- automation logs and UiPath jobs pages
- settings manifest visibility

Backend:

- Node.js and Express
- Zod validation
- JWT authentication
- role/permission checks
- Prisma repositories
- PostgreSQL persistence
- incident CRUD-style operations and workflow transitions
- upload validation/storage
- dashboard aggregations
- automation logs
- UiPath intake and callback bridge
- AI analysis service through an OpenAI-compatible API

RPA:

- UiPath Studio project in `rpa/DhlIncidentBot/`
- current baseline watches a local input folder for TXT samples
- posts intake payloads to backend
- sends job status callback
- moves files to Processed or Failed

AI:

- configured through `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`
- current documented target is NVIDIA NIM / DeepSeek using an OpenAI-compatible contract
- heuristic fallback exists for local demos when no live key is configured

## Backend Structure

```text
backend/src/
|-- config/
|-- constants/
|-- controllers/
|-- middleware/
|-- repositories/
|-- routes/
|-- services/
|-- utils/
`-- validators/
```

Key responsibilities:

- authenticate users
- protect APIs by role/permission
- validate requests
- manage incident lifecycle
- store attachments privately
- record workflow history
- aggregate dashboard data
- receive UiPath machine callbacks
- record automation results
- run and store AI analyses separately from reviewer-owned fields

## Frontend Structure

```text
frontend/src/
|-- assets/
|-- components/
|-- layouts/
|-- pages/
|-- router/
|-- services/
|-- stores/
`-- utils/
```

Key responsibilities:

- provide secure operational UI
- keep all data API-backed
- expose manual intake and evidence staging
- help reviewers search/filter incidents
- show status history and automation evidence
- keep AI suggestions visible but reviewer-controlled

## Database Model Areas

Implemented model areas should cover:

- users
- incidents
- incident attachments
- incident history
- incident comments
- incident AI analyses
- automation logs
- UiPath jobs

Potential additions for requirement completion:

- ~~processed input hashes for 14-day duplicate skip~~ (Implemented: `processed_hashes` table + `POST /api/uipath/duplicate-check`)
- ~~archived/deleted incident audit events if hard delete is not allowed~~ (Implemented: `DELETE /api/incidents/:id` archives to REJECTED with reason in `incident_history`)
- ~~RPA run summaries/email records~~ (Implemented: `POST /api/uipath/runs/summary` writes an automation log with totals and email target)
- ~~screenshot/evidence records for bot failure capture~~ (Implemented: bot uploads screenshot via `POST /api/uipath/uploads` and attaches the id to the failure callback)

## API Surface To Preserve

Core human APIs:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/incidents`
- `GET /api/incidents/:id`
- `POST /api/incidents`
- `PUT /api/incidents/:id`
- `PATCH /api/incidents/:id/status`
- `PATCH /api/incidents/:id/assignment`
- `POST /api/incidents/:id/comments`
- `GET /api/uploads`
- `POST /api/uploads`
- `GET /api/uploads/:id/download`
- `GET /api/dashboard/summary`
- `GET /api/automation/logs`

Core AI APIs:

- `POST /api/incidents/:id/ai-analyses`
- `POST /api/incidents/:id/ai-analyses/:analysisId/apply`

Core UiPath APIs:

- `GET /api/uipath/manifest`
- `GET /api/uipath/jobs`
- `GET /api/uipath/jobs/:jobReference`
- `POST /api/uipath/jobs/intake`
- `PATCH /api/uipath/jobs/:jobReference/status`

Requirement-sensitive API additions (all live now):

- `GET /api/incidents` accepts `tags` (CSV) and `creator` (substring match on `created_by`) alongside existing status/date/assignee filters
- `DELETE /api/incidents/:id` performs audit-safe archive (status â†’ `REJECTED`, tag `archived`, reason recorded in `incident_history`) and is Admin-only via `delete_incidents` permission
- `POST /api/uipath/duplicate-check` returns 14-day hash match data for the bot
- `POST /api/uipath/uploads` and `POST /api/uipath/uploads/:id/extract` give the bot machine-auth multipart upload and backend-side text extraction
- `POST /api/uipath/runs/summary` writes a run summary automation log with totals and email target

## Access Control Baseline

Roles:

- Admin: full operational and administrative access
- Reviewer: triage, assignment, workflow status, AI application, automation visibility
- Support Staff: manual intake and general operational visibility
- UiPath machine actor: shared-secret access only to machine bridge endpoints

Rules:

- Human users authenticate with JWT.
- UiPath authenticates with `x-uipath-key`.
- AI suggestions do not directly overwrite reviewer-owned fields without explicit apply action.
- Attachments should remain private and served through authenticated endpoints.

## UiPath Target Architecture

The required final RPA architecture should include:

- watched source from Google Drive sync folder or email-exported Drive folder
- file extraction for TXT, PDF, DOCX, and optionally image OCR
- hash calculation and 14-day duplicate lookup
- backend intake POST when not duplicate
- status callback PATCH
- file move to Processed, Duplicate, or Failed
- try/catch around each item
- screenshot capture on failure
- run log file
- summary email to admin with created/updated/duplicate/failed totals and log attachment

Current gap:

- the shipped bot is a TXT local-folder baseline. It proves the bridge concept but does not yet satisfy every mandatory RPA requirement.

## AI Architecture

AI should support:

- title cleanup
- summary generation
- category suggestion
- priority suggestion
- department routing
- duplicate candidate suggestion
- extracted-text polishing

Rules:

- Store AI analysis separately from incident fields.
- Show provider/model/confidence where possible.
- Label heuristic fallback honestly.
- Let reviewers apply selected suggestions deliberately.
- Do not make AI a chatbot feature unless it directly supports incident triage.

## Requirement-Critical Gaps

All previously listed gaps were closed in the May 2026 RPA + intake upgrade:

- PDF/DOCX extraction â†’ backend `POST /api/uploads/:id/extract` (pdf-parse + mammoth) and intake page auto-fill
- Tag and creator filters â†’ `tags` CSV and `creator` substring filters on `GET /api/incidents`
- CRUD delete â†’ `DELETE /api/incidents/:id` archives to `REJECTED` with audit history
- UiPath Drive/email-export source â†’ bot scans an operator-configurable Drive sync folder
- UiPath 14-day hash duplicate skip â†’ `processed_hashes` Prisma table + `POST /api/uipath/duplicate-check`
- UiPath screenshot capture â†’ bot captures via `System.Drawing` and uploads via machine-auth multipart endpoint
- UiPath summary email â†’ bot SMTP send + backend `POST /api/uipath/runs/summary` record
- Demo/report screenshots â†’ see updated `docs/demo-flow.md`

Open items now are purely report/demo polish, not implementation.
