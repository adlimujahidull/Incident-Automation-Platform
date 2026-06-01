# Product Scope

This document defines an implementation-ready product scope for the Incident Automation Platform: an AI-enhanced incident reporting and resolution platform.

This file answers: what product are we building, what must be visible to users, and what gaps still matter most.

## Product Positioning

The platform is an internal incident operations system for customer support and logistics teams.

It must feel like:

- a secured incident intake and triage platform
- a workflow-driven support operations tool
- an automation-assisted internal dashboard
- a realistic integration between web app, database, AI, and UiPath

It must not feel like:

- a generic CRUD assignment
- a static dashboard mockup
- a frontend-only prototype
- a UiPath screenshot with no real system integration

## Core Problem

Incident reports arrive from fragmented and unstructured sources:

- email inboxes
- WhatsApp, Telegram, or Teams messages
- phone call notes
- screenshots or parcel damage images
- handwritten warehouse instructions
- PDF, DOCX, TXT, and image evidence

The platform exists to turn these sources into structured, searchable, assignable, and auditable incident records.

## Primary Users

- Support Staff: stage raw evidence and create initial incident drafts.
- Reviewer: verify AI/RPA output, assign incidents, update workflow status, and resolve cases.
- Admin: manage operational visibility, users, integrations, automation health, and reporting evidence.
- UiPath Robot: machine actor that ingests raw files, submits incidents, updates job status, and records automation outcomes.

## Required Product Capabilities

The system must include:

- secured login and protected routes
- database-backed incident storage
- REST/JSON API for create, read, update, status transition, uploads, dashboard, and automation data
- raw evidence upload for text, PDF, and DOCX at minimum
- incident viewer with search and official filters: tag, date, creator, and status
- incident workflow status and history
- creator identity and machine actor tracking
- dashboard for operational reporting
- UiPath ingestion and callback integration
- RPA duplicate checking for the last 14 days using text/file hash
- RPA error handling, screenshots, logs, and summary email
- AI support for summary, title, classification, priority, department, and duplicate suggestions

## Requirement Status Snapshot

| Area | Product expectation | Status |
| --- | --- | --- |
| Authentication | Login, session restore, protected app | Implemented |
| Incident CRUD/API | API-backed create/read/update/status plus delete or audit-safe alternative | Implemented (audit-safe `DELETE /api/incidents/:id` archives to REJECTED with reason in history) |
| Upload console | Text, PDF, DOCX accepted and useful for incident creation | Implemented (`POST /api/uploads/:id/extract` returns extracted text + heuristic draft; Create Incident page auto-fills) |
| Search/filter | Filter by tag, date, creator, status | Implemented (tag chips + creator input + date range + status chips on register) |
| Workflow history | Incident status movement and timeline | Implemented |
| Dashboard | Management reporting and operational visibility | Implemented |
| AI triage | Suggestions for title, summary, classification, priority, department, duplicate | Implemented |
| UiPath intake | RPA can submit incidents through backend | Implemented |
| UiPath file source | Drive or email-exported Drive ingestion | Implemented (bot watches a Drive-sync folder; path configurable) |
| UiPath duplicate check | Skip recent duplicates by hash within 14 days | Implemented (`processed_hashes` + `POST /api/uipath/duplicate-check`) |
| UiPath evidence attachment | Attach files/screens to created content | Implemented (`POST /api/uipath/uploads` returns attachment id) |
| UiPath failure handling | Try/catch, logs, screenshot | Implemented (screenshot saved to disk, uploaded, attached to failure callback) |
| UiPath summary email | Email totals for created/updated/duplicates/failed with logs attached | Implemented (`POST /api/uipath/runs/summary` records run + optional SMTP send) |

## Scope Boundaries

In scope:

- Incident intake, triage, assignment, and resolution workflow.
- File/evidence handling for operational incident reports.
- UiPath automation as a mandatory ingestion layer.
- AI as a triage assistant, not an autonomous decision maker.
- Management dashboard and automation logs for review evidence.

Out of scope unless explicitly needed:

- Knowledge-base article publishing.
- Public customer portal.
- Real production system connectivity.
- Payment, shipment tracking API, or courier dispatch optimization.
- Replacing human review with fully autonomous AI decisions.

## Acceptance Criteria

The product can be considered assignment-ready only when:

- a reviewer can log in and use the app without local code knowledge
- incidents are stored in PostgreSQL and loaded through APIs
- raw evidence can be uploaded and linked to incidents
- PDF/DOCX/text support is visible and explainable
- search/filter works for the official fields or the limitation is fixed
- every status change is visible in history
- UiPath can run from Studio and create or update platform data
- UiPath demonstrates duplicate handling, failure logs, screenshot capture, and summary email
- API CRUD behavior can be shown in demo or report
- screenshots and report sections align with the actual implementation, not aspirational features

## Product Narrative For Demo

Use this story:

```text
Messy customer incident arrives from an operations channel
  -> raw file is ingested manually or by UiPath
  -> duplicate detection checks the recent 14-day window
  -> structured incident is created in the database
  -> AI suggests cleaner triage fields
  -> reviewer confirms assignment and status
  -> dashboard updates for management visibility
  -> timeline and automation logs prove accountability
```

## Non-Negotiable Constraints

- Do not hardcode final production behavior in the frontend.
- Do not claim mandatory RPA features are complete unless they can be demonstrated.
- Do not hide current gaps by marking all roadmap phases complete.
- Do not treat AI as a substitute for required UiPath automation.
- Do not use knowledge-base/SOP article language unless explaining why it does not apply.
- Do not expose raw machine identifiers in user-facing UI unless they are intentionally part of technical evidence.
