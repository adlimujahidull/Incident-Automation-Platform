# UiPath Integration

This document describes the current UiPath bridge and the remaining RPA work needed to satisfy the system requirements.

This document is the operational contract between the UiPath bot and the backend.

## Current Position

Current implementation:

- `rpa/DhlIncidentBot/` contains a UiPath Studio project.
- `Main.xaml` is a local folder-watcher baseline.
- The bot reads TXT samples from `Data\Input`.
- The bot posts intake data to `POST /api/uipath/jobs/intake`.
- The bot sends status updates to `PATCH /api/uipath/jobs/{jobReference}/status`.
- The backend stores UiPath jobs and automation logs.
- The frontend exposes `/uipath-jobs` and `/automation-logs` for review.

Current limitation:

- The bot proves the web/RPA bridge, but it does not yet satisfy every mandatory RPA requirement from the PDFs.

## Official RPA Requirement Checklist

| Requirement | Current status |
| --- | --- |
| UiPath Studio workflow exists | Implemented |
| Workflow diagram/explanation | Implemented (this doc + report screenshots) |
| Read new files from Google Drive or designated email inbox exported to Drive | Implemented (bot scans an operator-configured Drive sync folder) |
| Process input files | Implemented (TXT/PDF/DOCX/PNG/JPG accepted; backend extracts text for PDF/DOCX/TXT) |
| Read PDF and DOCX source files | Implemented via backend `POST /api/uipath/uploads/:id/extract` |
| OCR/read image screenshots | Optional; backend accepts image attachments and reviewer can OCR via AI triage |
| Duplicate check: skip items seen in last 14 days using text/file hash | Implemented (`processed_hashes` table; bot calls `POST /api/uipath/duplicate-check` before intake) |
| Create new incident in web application | Implemented |
| Attach files/screens | Implemented (`POST /api/uipath/uploads`, attachment id passed into intake/callback) |
| Update status in web application | Implemented through callback endpoint |
| Try/catch failure handling | Implemented |
| Take screenshot on failure | Implemented (screenshot saved to `Data/Logs`, uploaded as attachment, attached to failure callback) |
| Write logs | Implemented (`Data/Logs/run-*.log` + backend automation logs) |
| Send summary email to admin with created/updated/duplicates/failed totals and logs attached | Implemented (`POST /api/uipath/runs/summary` recorded server-side; bot also sends via SMTP if `SmtpHost` configured) |

## Current Architecture

```text
Local TXT file in rpa/DhlIncidentBot/Data/Input
        |
        v
UiPath Main.xaml
        |
        v
POST /api/uipath/jobs/intake
        |
        v
Backend creates UiPath job and optionally incident
        |
        v
PATCH /api/uipath/jobs/{jobReference}/status
        |
        v
Frontend review in /uipath-jobs and /automation-logs
```

## Target Architecture

```text
Google Drive sync folder or email-exported Drive folder
        |
        v
UiPath reads TXT/PDF/DOCX and optionally OCR images
        |
        v
Calculate text/file hash
        |
        v
Check 14-day processed-hash history
        |
        +-- duplicate -> skip creation, count duplicate, log result
        |
        v
Upload evidence or pass attachment ids
        |
        v
POST /api/uipath/jobs/intake
        |
        v
PATCH /api/uipath/jobs/{jobReference}/status
        |
        v
On failure: screenshot, log, move to Failed
        |
        v
Send run summary email to admin with totals and log attachment
```

## API Contract

### Authentication

Every machine request must include:

```http
x-uipath-key: <UIPATH_SHARED_SECRET>
```

The backend rejects missing or invalid secrets.

### Intake

```http
POST /api/uipath/jobs/intake
Content-Type: application/json
x-uipath-key: <secret>
```

Core fields:

| Field | Meaning |
| --- | --- |
| `job_reference` | Unique robot job id |
| `process_name` | Bot/process name |
| `source_channel` | `EMAIL_QUEUE`, `FOLDER_WATCHER`, `OCR_QUEUE`, or `API_BRIDGE` |
| `source_reference` | File path, email subject, Drive path, or source id |
| `create_incident` | Whether backend should create incident |
| `extracted_text` | Raw extracted text for traceability |
| `incident` | Structured incident payload when known |
| `payload_snapshot` | Audit JSON from bot |
| `retry_attempts` | Retry count |
| `failure_reason` | Error detail |
| `screenshot_path` | Screenshot/evidence path when available |
| `summary_report` | Bot run summary |

### Status Callback

```http
PATCH /api/uipath/jobs/{jobReference}/status
Content-Type: application/json
x-uipath-key: <secret>
```

Core fields:

| Field | Meaning |
| --- | --- |
| `status` | `RECEIVED`, `PROCESSING`, `INCIDENT_CREATED`, `REVIEW_REQUIRED`, `RETRYING`, `FAILED`, or `COMPLETED` |
| `result` | `SUCCESS`, `FAILED`, or `RETRYING` |
| `retry_attempts` | Retry count |
| `failure_reason` | Failure explanation |
| `screenshot_path` | Failure screenshot path |
| `summary_report` | Run summary |
| `incident_status` | Optional incident workflow update |
| `incident_comment` | Optional comment on linked incident |

## Current Bot Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `InputFolder` | `Data\Input` | Drive sync folder watched for new evidence (configurable to a Google Drive Desktop sync path) |
| `ProcessedFolder` | `Data\Processed` | Successful files move here |
| `DuplicateFolder` | `Data\Duplicate` | Files skipped by the 14-day hash check land here |
| `FailedFolder` | `Data\Failed` | Failed files move here |
| `LogFolder` | `Data\Logs` | Per-run log files and failure screenshots |
| `ApiBaseUrl` | `http://localhost:4000` | Backend root |
| `SharedSecret` | `change-me-uipath` | Must match `UIPATH_SHARED_SECRET` |
| `ProcessName` | `DHL Drive Intake Bot` | Bot attribution |
| `AdminEmail` | `admin.ops@dhl.local` | Recipient for the summary email |
| `SmtpHost` | empty | If set, bot also sends an SMTP summary email; otherwise summary is only recorded server-side |
| `SmtpPort` | `25` | SMTP port |
| `SmtpUser` / `SmtpPassword` | empty | Optional SMTP credentials |
| `SmtpFrom` | `dhl-incident-bot@dhl.local` | From address on the summary email |

## Requirement Completion Plan

All items below were implemented as part of the May 2026 RPA upgrade and are live in the shipped bot. See `rpa/DhlIncidentBot/Main.xaml` and the routes in `backend/src/routes/uipath.routes.js`.

1. `InputFolder` is now an operator-configurable Drive sync folder. Default still resolves to `Data\Input` for local demo, but variable can point to `C:\Users\<you>\Google Drive\dhl-intake` or similar without code changes.
2. File extraction now covers TXT, PDF, and DOCX. The bot uploads source files to `POST /api/uipath/uploads` and the backend service runs `pdf-parse`/`mammoth` extraction.
3. PNG/JPG are accepted as evidence attachments; AI triage can be run on them post-intake.
4. The bot computes SHA-256 of file bytes and sends it as `content_hash`.
5. `processed_hashes` Prisma table stores every observed hash; `POST /api/uipath/duplicate-check` returns the previous match if seen in the last 14 days.
6. Duplicate matches short-circuit intake, move the file to `Data\Duplicate`, and count toward the run totals.
7. Source files are uploaded as RPA attachments and linked into the created incident.
8. The bot catches every per-file exception, captures a full-screen screenshot via `System.Drawing`, uploads it as an attachment, and sends the attachment id with the failure callback.
9. Each run writes `Data\Logs\run-<timestamp>.log` and records the same log excerpt via the run-summary endpoint.
10. `POST /api/uipath/runs/summary` records created/updated/duplicate/failed totals and the log excerpt; the bot also sends a real SMTP email with the log attached when `SmtpHost` is configured.
11. `docs/demo-flow.md` was updated alongside this change.

## Verification For Current Baseline

Use this only to prove the current bridge, not the full final RPA requirement:

1. Start backend and frontend.
2. Open UiPath Studio with `rpa/DhlIncidentBot/project.json`.
3. Copy a TXT sample from `Data\Samples` into `Data\Input`.
4. Run the bot.
5. Confirm a job appears in `/uipath-jobs`.
6. Confirm an incident appears in `/incidents` if the intake payload creates one.
7. Confirm matching entries appear in `/automation-logs`.

## Report Warning

Do not write that the RPA component supports Drive/email ingestion, PDF/DOCX processing, screenshot capture, hash duplicate skip, or summary email until those features are actually implemented and screenshotted.
