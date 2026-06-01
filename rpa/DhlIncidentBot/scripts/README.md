# Email → Data/Input bridge

This helper connects to an IMAP inbox (Gmail, Outlook/Office 365, or any IMAPS server), downloads unread message attachments into the bot's `Data/Input` folder, and (optionally) marks the messages as read or moves them to a "Processed" mail label.

Once the attachments land in `Data/Input`, the existing UiPath bot picks them up unchanged — the SHA-256 dedup, extraction, screenshot-on-failure, and summary email flows all continue to work.

This satisfies the assignment's "ingestion from Google Drive or a designated email inbox" requirement without modifying the UiPath workflow.

## Setup (one time)

```bash
cd rpa/DhlIncidentBot/scripts
cp .env.example .env
# Edit .env with your IMAP credentials (see notes below)
npm install
```

### Gmail credentials

1. Enable 2-Step Verification on the Gmail account.
2. Visit https://myaccount.google.com/apppasswords and generate an App Password for "Mail".
3. Put the 16-character App Password into `.env` as `IMAP_PASSWORD`. Use the full email as `IMAP_USER`.

### Outlook / Office 365

Use `imap-mail.outlook.com` port `993` with an App Password (Modern Auth must be allowed on the account).

## Run once

```bash
npm run fetch
```

The script will:

1. Connect to `IMAP_HOST:IMAP_PORT` over TLS.
2. Open `IMAP_FOLDER` (default `INBOX`).
3. For every unread message, save attachments whose extension is `.pdf`, `.docx`, `.txt`, `.png`, `.jpg`, or `.jpeg` into `IMAP_OUTPUT_DIR` (default `../Data/Input`).
4. Mark the message as `\Seen` (set `IMAP_MARK_SEEN=false` to skip this).
5. If `IMAP_PROCESSED_FOLDER` is set, move the message to that IMAP folder/label.

Filenames are timestamp-prefixed (e.g. `2026-05-22T06-15-23-456Z__damaged-parcel.pdf`) so collisions are impossible.

## Schedule it (optional)

To keep the inbox flowing without manual runs:

- **Windows Task Scheduler** — Create a task that runs `npm run fetch` every 5–10 minutes inside this folder.
- **UiPath** — In Studio, add a `Start Process` activity at the very start of `Main.xaml` that invokes `npm.cmd` with arguments `run fetch` in this directory. The rest of the workflow stays untouched.

## Demo story

> "Customer sends a complaint with a PDF attached to incidents@dhl-demo.com. The email bridge polls the inbox, drops the PDF into `Data/Input`, and the UiPath bot then extracts the text, hashes the file, creates the incident in the platform, and emails the admin the summary. No human touched the file."
