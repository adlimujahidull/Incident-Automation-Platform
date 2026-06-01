# DHL Incident Bot - UiPath Studio Project

This folder contains the UiPath Studio project that backs the Scenario 2 RPA layer. It is no longer a TXT-only baseline. The bot now satisfies the official RPA requirements end-to-end: Drive-folder ingestion, multi-format extraction (TXT/PDF/DOCX), 14-day hash duplicate skip, screenshot capture on failure, evidence uploads, and a run summary email.

## Workflow At A Glance

```text
Data\Input\*.{txt,pdf,docx,png,jpg,jpeg}            (Google Drive sync folder)
        |
        v
SHA-256 of file bytes
        |
        v
POST /api/uipath/duplicate-check (x-uipath-key)     skip if seen in last 14 days -> Data\Duplicate
        |
        v
POST /api/uipath/uploads (multipart) -> attachment_id
        |
        v
POST /api/uipath/uploads/:id/extract -> extracted_text
        |
        v
POST /api/uipath/jobs/intake (with extracted_text + content_hash + attachment id)
        |
        v
PATCH /api/uipath/jobs/{ref}/status (COMPLETED)
        |
        v
Move source file to Data\Processed
        |
        v
(on exception) Take screenshot -> upload -> PATCH FAILED callback -> Data\Failed
        |
        v
POST /api/uipath/runs/summary (totals + log excerpt)
        |
        v
SMTP email to AdminEmail with run log attached (if SmtpHost configured)
```

The bot authenticates every call with the `x-uipath-key` shared-secret header.

## Prerequisites

| Tool | Requirement |
| --- | --- |
| UiPath Studio | 23.10 LTS or newer |
| Backend | Running on `http://localhost:4000` with the new Phase 10 migration applied |
| Frontend | Running on `http://localhost:5173` for verification |
| Backend env | `UIPATH_SHARED_SECRET` must match the bot `SharedSecret` variable |

## Open The Project

1. Launch UiPath Studio.
2. Open `rpa/DhlIncidentBot/project.json`.
3. Restore dependencies if Studio prompts you.
4. Open `Main.xaml`.

## Configure Runtime Variables

Edit the variables at the top of the root sequence in `Main.xaml`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `InputFolder` | `Data\Input` | Drive sync folder watched for new evidence. Point this at your Google Drive Desktop sync path for the official demo. |
| `ProcessedFolder` | `Data\Processed` | Successful files move here |
| `DuplicateFolder` | `Data\Duplicate` | Files skipped by the 14-day hash check |
| `FailedFolder` | `Data\Failed` | Files that hit an exception |
| `LogFolder` | `Data\Logs` | Per-run `run-*.log` files and `failure-*.png` screenshots |
| `ApiBaseUrl` | `http://localhost:4000` | Backend root URL |
| `SharedSecret` | `change-me-uipath` | Must match backend `UIPATH_SHARED_SECRET` |
| `ProcessName` | `DHL Drive Intake Bot` | Bot/process attribution |
| `AdminEmail` | `admin.ops@dhl.local` | Recipient on the summary email |
| `SmtpHost` | empty | If set, the bot sends a real SMTP summary email. If empty, the run summary is only recorded server-side. |
| `SmtpPort` | `25` | SMTP port |
| `SmtpUser` / `SmtpPassword` | empty | Optional SMTP credentials |
| `SmtpFrom` | `dhl-incident-bot@dhl.local` | From address on the summary email |

## Run The Demo

1. Drop one or more files from `Data\Samples\` into `Data\Input\` (or pick a real PDF/DOCX complaint).
2. Click Run in UiPath Studio.
3. Studio Output shows each step: hash, duplicate check, upload id, extraction, intake response, callback, file move.
4. Frontend:
   - `/uipath-jobs` shows the new job with linked incident and attachment.
   - `/automation-logs` shows the `JOB_RECEIVED` → `INCIDENT_CREATED` → `JOB_COMPLETED` chain plus the `RUN_SUMMARY_EMAIL` entry at the end of the run.
   - `/incidents` shows the new incident populated from the extracted text (tags include `rpa-intake`).
5. To prove the 14-day rule, re-drop the same file into `Data\Input\` and re-run. The file should move to `Data\Duplicate` with no new incident created. The `processed_hashes` row in PostgreSQL has the source reference and timestamp.
6. To prove the failure path, drop a corrupt or zero-byte file. The bot:
   - logs the exception
   - saves a PNG screenshot in `Data\Logs\failure-*.png`
   - uploads the screenshot via `POST /api/uipath/uploads`
   - patches a `FAILED` callback with the screenshot attachment id
   - moves the file to `Data\Failed`
7. At the end of every run the bot writes `Data\Logs\run-<timestamp>.log` and POSTs totals to `POST /api/uipath/runs/summary`. If `SmtpHost` is set, the same payload is also delivered as an email with the log attached.

## File Layout

```text
rpa/DhlIncidentBot/
|-- project.json
|-- Main.xaml
|-- README.md
`-- Data/
    |-- Input/        (Drive sync folder)
    |-- Processed/    (successful intakes)
    |-- Duplicate/    (skipped by 14-day hash rule)
    |-- Failed/       (intake exceptions)
    |-- Logs/         (run logs + failure screenshots)
    `-- Samples/      (demo input files)
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `401 Unauthorized` | Secret mismatch | Make `SharedSecret` match backend `UIPATH_SHARED_SECRET` |
| Extraction unavailable | Backend missing `pdf-parse`/`mammoth` | Re-run `npm install` in `backend/` |
| Duplicate skip not firing | Older incidents predate the hash store | New hashes are recorded from this point onward; re-run the same file to verify |
| Screenshot empty / black | Bot ran headless or no desktop session | Run Studio in an interactive session for the failure-path demo |
| Summary email not sent | `SmtpHost` empty | Either set SMTP variables or rely on the server-side `POST /api/uipath/runs/summary` record |
| HTTP timeout | Backend not running | Start backend on `http://localhost:4000` |

## Reference

See `docs/uipath-integration.md` for the full API contract and `docs/demo-flow.md` for the recorded-demo script.
