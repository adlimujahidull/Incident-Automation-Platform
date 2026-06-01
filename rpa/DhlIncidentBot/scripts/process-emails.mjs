import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Blob } from "node:buffer";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  IMAP_HOST = "imap.gmail.com",
  IMAP_PORT = "993",
  IMAP_USER,
  IMAP_PASSWORD,
  IMAP_FOLDER = "INBOX",
  IMAP_MARK_SEEN = "true",
  BACKEND_URL = "http://localhost:4000",
  UIPATH_SHARED_SECRET = "change-me-uipath",
  PROCESS_NAME = "DHL Email Intake Bot"
} = process.env;

const inputDir = path.resolve(__dirname, "../Data/Input");
const processedDir = path.resolve(__dirname, "../Data/Processed");
const duplicateDir = path.resolve(__dirname, "../Data/Duplicate");
const failedDir = path.resolve(__dirname, "../Data/Failed");
const logsDir = path.resolve(__dirname, "../Data/Logs");

const EXTRACTABLE_EXTENSIONS = new Set([".pdf", ".docx", ".txt"]);

const MIME_BY_EXT = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitize(name) {
  return String(name ?? "attachment").replace(/[^\w.\- ]+/g, "_").slice(0, 200);
}

async function ensureDirs() {
  for (const dir of [inputDir, processedDir, duplicateDir, failedDir, logsDir]) {
    await fs.mkdir(dir, { recursive: true });
  }
}

function buildJobReference() {
  const stamp = timestamp().replace(/[^0-9]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `EMAIL-${stamp}-${suffix}`;
}

function buildRunReference() {
  const stamp = timestamp().replace(/[^0-9]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `EMAIL-RUN-${stamp}-${suffix}`;
}

async function moveFile(source, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, path.basename(source));
  await fs.rename(source, target).catch(async () => {
    await fs.copyFile(source, target);
    await fs.unlink(source).catch(() => undefined);
  });
  return target;
}

async function callJson(pathName, body) {
  const response = await fetch(`${BACKEND_URL}${pathName}`, {
    method: "POST",
    headers: {
      "x-uipath-key": UIPATH_SHARED_SECRET,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${pathName} failed (${response.status}): ${text}`);
  }

  return payload;
}

async function uploadFile(filePath, fileName, sourceLabel) {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), fileName);
  form.append("source_type", "EMAIL");
  form.append("source_label", sourceLabel);
  form.append("notes", "Auto-uploaded by email intake bot.");

  const response = await fetch(`${BACKEND_URL}/api/uipath/uploads`, {
    method: "POST",
    headers: {
      "x-uipath-key": UIPATH_SHARED_SECRET,
      "x-process-name": PROCESS_NAME
    },
    body: form
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status}): ${text}`);
  }

  return JSON.parse(text);
}

async function extractAttachment(attachmentId) {
  const response = await fetch(`${BACKEND_URL}/api/uipath/uploads/${attachmentId}/extract`, {
    method: "POST",
    headers: { "x-uipath-key": UIPATH_SHARED_SECRET }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Extract failed (${response.status}): ${text}`);
  }

  return JSON.parse(text);
}

async function processOneAttachment({ filePath, fileName, sourceLabel, ext, sender, subject }) {
  const buffer = await fs.readFile(filePath);
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

  const dupCheck = await callJson("/api/uipath/duplicate-check", {
    content_hash: contentHash,
    source_channel: "EMAIL_QUEUE",
    source_reference: sourceLabel,
    window_days: 14
  });

  if (dupCheck.duplicate) {
    const movedTo = await moveFile(filePath, duplicateDir);
    return {
      outcome: "duplicate",
      contentHash,
      message: `Duplicate of original processed at ${dupCheck.original_processed_at} (job ${dupCheck.original_job_reference}). File moved to Data/Duplicate.`,
      finalPath: movedTo
    };
  }

  if (!EXTRACTABLE_EXTENSIONS.has(ext)) {
    const movedTo = await moveFile(filePath, failedDir);
    return {
      outcome: "failed",
      contentHash,
      message: `Extension ${ext} is not extractable by backend. File moved to Data/Failed.`,
      finalPath: movedTo
    };
  }

  const uploadResult = await uploadFile(filePath, fileName, sourceLabel);
  const attachmentId = uploadResult.attachment?.id ?? uploadResult.id;

  if (!attachmentId) {
    throw new Error(`Upload did not return an attachment id. Response: ${JSON.stringify(uploadResult)}`);
  }

  const extractResult = await extractAttachment(attachmentId);
  const draft = extractResult.draft ?? {};
  const extractedText = String(extractResult.extracted_text ?? "");

  if (!draft.title || !draft.summary || extractedText.length < 30) {
    throw new Error("Extraction produced insufficient content to create an incident");
  }

  const jobReference = buildJobReference();
  const intake = await callJson("/api/uipath/jobs/intake", {
    job_reference: jobReference,
    process_name: PROCESS_NAME,
    source_channel: "EMAIL_QUEUE",
    source_reference: sourceLabel,
    create_incident: true,
    extracted_text: extractedText.slice(0, 8000),
    summary_report: `Email "${subject}" from ${sender}`,
    payload_snapshot: {
      email_subject: subject,
      email_from: sender,
      attachment_name: fileName,
      attachment_size_bytes: buffer.length
    },
    content_hash: contentHash,
    incident: {
      title: String(draft.title).slice(0, 180),
      summary: String(draft.summary).slice(0, 4000),
      category: draft.category,
      priority: draft.priority,
      assigned_department: draft.assigned_department,
      tags: [...(Array.isArray(draft.tags) ? draft.tags : []), "email-intake"].slice(0, 12),
      suggested_action: draft.suggested_action ?? undefined,
      attachment_ids: [attachmentId],
      notes: `Auto-created from email "${subject}" sent by ${sender}.`
    }
  });

  const movedTo = await moveFile(filePath, processedDir);

  return {
    outcome: "created",
    contentHash,
    jobReference,
    attachmentId,
    incident: intake.incident ?? intake.job?.related_incident_id ?? null,
    incidentCode: intake.incident?.incident_code,
    incidentId: intake.incident?.id,
    finalPath: movedTo
  };
}

async function main() {
  if (!IMAP_USER || !IMAP_PASSWORD) {
    console.error("IMAP_USER and IMAP_PASSWORD must be set in .env");
    process.exit(1);
  }

  await ensureDirs();

  const runReference = buildRunReference();
  const startedAt = new Date();
  const logLines = [];
  const logFile = path.join(logsDir, `run-${timestamp()}.log`);

  function log(line) {
    console.log(line);
    logLines.push(`[${new Date().toISOString()}] ${line}`);
  }

  log(`Run ${runReference} started.`);
  log(`Backend: ${BACKEND_URL}`);

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: Number(IMAP_PORT),
    secure: Number(IMAP_PORT) === 993,
    auth: { user: IMAP_USER, pass: IMAP_PASSWORD },
    logger: false
  });

  await client.connect();
  log(`Connected to ${IMAP_HOST}:${IMAP_PORT} as ${IMAP_USER}`);

  const totals = { created: 0, updated: 0, duplicates: 0, failed: 0 };
  const seenUids = [];

  try {
    const lock = await client.getMailboxLock(IMAP_FOLDER);

    try {
      const unseenUids = await client.search({ seen: false }, { uid: true });
      log(`Found ${unseenUids.length} unread message(s).`);

      for (const uid of unseenUids) {
        const message = await client.fetchOne(uid, { source: true, uid: true }, { uid: true });
        if (!message) continue;

        const parsed = await simpleParser(message.source);
        const subject = parsed.subject ?? "(no subject)";
        const sender = parsed.from?.text ?? "(unknown sender)";
        const attachments = parsed.attachments ?? [];

        log(`\n→ Message UID ${uid}: "${subject}" from ${sender} (${attachments.length} attachment(s))`);

        if (attachments.length === 0) {
          log("   · No attachments — skipping.");
          seenUids.push(uid);
          continue;
        }

        for (const attachment of attachments) {
          const rawName = attachment.filename ?? "attachment.bin";
          const ext = path.extname(rawName).toLowerCase();
          const safeName = `${timestamp()}__${sanitize(rawName)}`;
          const filePath = path.join(inputDir, safeName);

          await fs.writeFile(filePath, attachment.content);
          log(`   · Saved ${rawName} → ${filePath}`);

          try {
            const result = await processOneAttachment({
              filePath,
              fileName: rawName,
              sourceLabel: `email:${IMAP_USER}/${subject}`,
              ext,
              sender,
              subject
            });

            if (result.outcome === "created") {
              totals.created += 1;
              log(`   ✓ Incident ${result.incidentCode ?? result.incidentId ?? "(id unknown)"} created. Job ${result.jobReference}. File → ${path.basename(result.finalPath)}.`);
            } else if (result.outcome === "duplicate") {
              totals.duplicates += 1;
              log(`   ↻ ${result.message}`);
            } else {
              totals.failed += 1;
              log(`   ✗ ${result.message}`);
            }
          } catch (error) {
            totals.failed += 1;
            log(`   ✗ Error: ${error.message}`);
            try {
              await moveFile(filePath, failedDir);
            } catch {
              // ignore
            }
          }
        }

        seenUids.push(uid);
      }

      if (IMAP_MARK_SEEN === "true" && seenUids.length) {
        await client.messageFlagsAdd(seenUids, ["\\Seen"], { uid: true });
        log(`\nMarked ${seenUids.length} message(s) as \\Seen.`);
      }
    } finally {
      lock.release();
    }
  } finally {
    await Promise.race([
      client.logout(),
      new Promise((resolve) => setTimeout(resolve, 3000))
    ]).catch(() => {});
    client.close();
  }

  const finishedAt = new Date();
  log(`\nRun ${runReference} finished.`);
  log(`Totals: created=${totals.created}, duplicates=${totals.duplicates}, failed=${totals.failed}`);

  await fs.writeFile(logFile, logLines.join("\n") + "\n", "utf8");
  log(`Log written to ${logFile}`);

  try {
    await callJson("/api/uipath/runs/summary", {
      job_reference: runReference,
      process_name: PROCESS_NAME,
      source_channel: "EMAIL_QUEUE",
      totals,
      summary_report: `Email intake run ${runReference}. Processed ${seenUids.length} message(s) from ${IMAP_USER}. Created ${totals.created} incident(s), skipped ${totals.duplicates} duplicate(s), failed ${totals.failed}.`,
      log_excerpt: logLines.slice(-30).join("\n"),
      email_target: process.env.ADMIN_EMAIL ?? undefined,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString()
    });
    console.log("\nRun summary recorded on backend.");
  } catch (error) {
    console.warn(`\nCould not record run summary: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Email intake run failed:", error);
    process.exit(1);
  });
