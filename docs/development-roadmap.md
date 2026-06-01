# Development Roadmap

This roadmap tracks the remaining planned work for the incident management platform.

The previous roadmap treated all phases as complete. That is not safe for delivery because specific RPA, upload, filter, CRUD, and demo requirements still need stronger implementation evidence.

## Current Baseline

Already available:

- Vue 3 frontend and Express backend
- PostgreSQL persistence through Prisma
- login, JWT-backed session restore, and role-aware navigation
- incident creation, list/detail views, assignment, status transitions, comments, and history
- private upload storage with validation for PDF, DOCX, PNG, JPG, JPEG, and TXT
- dashboard aggregations and operational widgets
- automation logs and UiPath job bridge
- AI triage service using an OpenAI-compatible API, with NVIDIA NIM / DeepSeek configuration documented
- UiPath Studio project under `rpa/DhlIncidentBot/` for a text-file folder watcher baseline
- backend and frontend test harnesses

Recently delivered (May 2026 RPA + intake upgrade):

- PDF/DOCX/TXT content extraction live at `POST /api/uploads/:id/extract`; Create Incident page has an "Auto-fill from selected file" button
- Incident register now supports explicit tag chips and a creator substring filter, surfaced in `IncidentFilterPanel.vue` and the API query schema
- Audit-safe delete at `DELETE /api/incidents/:id` archives to `REJECTED`, tags as `archived`, and records the reason in `incident_history`; UI affordance on incident detail page (Admin only)
- UiPath bot watches an operator-configurable Drive sync folder, accepts TXT/PDF/DOCX/PNG/JPG, calls backend-side extraction
- 14-day hash duplicate skip backed by `processed_hashes` Prisma table and `POST /api/uipath/duplicate-check`
- Bot uploads source files and failure screenshots through `POST /api/uipath/uploads` (machine auth); attachment ids flow into intake and callback payloads
- `POST /api/uipath/runs/summary` records created/updated/duplicate/failed totals with log excerpt; bot optionally sends an SMTP summary email with the log file attached

Remaining (delivery polish, not implementation):

- final report screenshots and architecture diagrams that match the upgraded bot flow
- recorded demo video that walks through the duplicate-skip and screenshot-capture cases

## Phase 0: Requirement Documentation Reset

Goal:
Make the documentation honest, requirement-driven, and safe to use as the implementation reference.

Tasks:

1. extract requirements directly from the product scope
2. keep scope focused on incident reporting and resolution
3. add requirement traceability and current status
4. update product scope and roadmap so they do not claim all work is complete
5. align README/docs navigation with the corrected source of truth

Done when:

- product-scope and roadmap clearly list mandatory requirements
- each major requirement has a current status or gap
- developers can choose next work from the documented priority list

## Phase 1: Intake Extraction Completion

Goal:
Make the upload console satisfy the official text/PDF/DOCX input requirement beyond simple file storage.

Tasks:

1. verify current upload flow for TXT, PDF, and DOCX
2. add backend extraction for TXT/PDF/DOCX, or add a clear processing endpoint that creates a structured draft from uploaded evidence
3. expose extracted text or AI-generated draft fields in the intake UI
4. store extraction status and errors
5. add tests for supported file types and extraction failure paths

Done when:

- a PDF or DOCX can be uploaded and used to create a structured incident without manually retyping all content
- report screenshots can show raw evidence becoming incident fields

## Phase 2: Official Viewer Filters and CRUD Evidence

Goal:
Close the web application rubric gaps around viewer filters and API CRUD.

Tasks:

1. add explicit tag filter support to incident API and UI
2. add explicit creator filter support to incident API and UI
3. confirm date and status filters are visible and documented
4. decide whether incidents can be hard deleted
5. if deletion is allowed, implement authenticated `DELETE /api/incidents/:id`
6. if deletion is not allowed, document and demo the audit-safe alternative (`REJECTED`, `CLOSED`, or archived state)
7. update API examples for the report

Done when:

- viewer filters satisfy tag, date, creator, and status
- CRUD can be demonstrated clearly in API walkthrough

## Phase 3: UiPath Source and File-Type Upgrade

Goal:
Bring the UiPath bot closer to the official RPA ingestion requirement.

Tasks:

1. configure the watched folder as a Google Drive sync folder or email-exported Drive folder for demo
2. update documentation and screenshots to show the source path as Drive/email-exported input
3. extend UiPath file reading beyond `*.txt` to PDF and DOCX
4. optionally add OCR branch for PNG/JPG screenshots
5. keep the same backend intake contract after extraction

Done when:

- demo can say "Drive/email-exported folder" honestly
- UiPath can process at least TXT, PDF, and DOCX source files

## Phase 4: UiPath Duplicate Hash Rule

Goal:
Satisfy the mandatory duplicate check: skip items seen in the last 14 days using hash of text or file.

Tasks:

1. compute a stable hash for extracted text or file bytes
2. store processed hashes with processed timestamp, source reference, result, and job reference
3. add backend endpoint or UiPath-local storage for 14-day duplicate lookup
4. ensure duplicates are skipped before creating a new incident
5. record duplicate counts in job summary/logs
6. add demo sample that proves a second run is skipped as duplicate

Done when:

- running the same input twice within 14 days does not create a second active incident
- the automation log or summary clearly says duplicate/skipped

## Phase 5: UiPath Failure Evidence and Summary Email

Goal:
Satisfy RPA robustness requirements.

Tasks:

1. add screenshot capture in UiPath catch/failure path
2. pass screenshot path or upload screenshot evidence to backend
3. ensure failed jobs write platform logs with matching job reference
4. calculate run totals: created, updated, duplicates, failed
5. send summary email to system admin at the end of each run
6. attach execution logs to the summary email or provide a generated log file
7. document SMTP/mail test setup for local demo

Done when:

- a forced failure produces a screenshot/log record
- a summary email or local mail-catcher output is visible in the demo

## Phase 6: Report and Demo Hardening

Goal:
Make delivery evidence match the official marking rubric.

Tasks:

1. update `docs/demo-flow.md` after the RPA upgrades
2. capture screenshots for login, upload, viewer filters, incident detail, timeline, dashboard, API calls, UiPath workflow, logs, email summary
3. prepare API JSON examples for report
4. prepare architecture diagram and RPA workflow diagram
5. verify the demo can fit into 10-12 minutes
6. run backend tests, frontend tests, and production build before final submission

Done when:

- report can be written from actual screenshots and API examples
- demo video covers UI, CRUD/API, workflow, RPA, and integration without hand-waving

## Priority Order

All eight prior priorities (1 through 7) are implemented. Only the final demo/report polish remains.

1. ~~Intake extraction for PDF/DOCX/text~~ â€” done
2. ~~Tag and creator filters~~ â€” done
3. ~~CRUD delete/equivalent decision~~ â€” done (audit-safe archive)
4. ~~UiPath Drive/email-export source framing~~ â€” done
5. ~~UiPath duplicate hash skip~~ â€” done
6. ~~UiPath screenshot on failure~~ â€” done
7. ~~UiPath summary email~~ â€” done
8. Demo/report evidence update â€” pending (capture screenshots, record video, write 8â€“12 page report against the upgraded flow)

## Definition Of Release-Ready

The project is release-ready when:

- mandatory requirements can be demonstrated end to end
- all major gaps are closed or explicitly justified
- UiPath is demonstrably central to the workflow
- the report and video use real project evidence
- the final documentation does not overclaim unfinished features
