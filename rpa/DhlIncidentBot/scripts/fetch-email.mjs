import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { promises as fs } from "node:fs";
import path from "node:path";
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
  IMAP_OUTPUT_DIR,
  IMAP_PROCESSED_FOLDER,
  IMAP_MARK_SEEN = "true"
} = process.env;

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"]);

const outputDir = path.resolve(__dirname, IMAP_OUTPUT_DIR ?? "../Data/Input");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitize(name) {
  return String(name ?? "attachment")
    .replace(/[^\w.\- ]+/g, "_")
    .slice(0, 200);
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function main() {
  if (!IMAP_USER || !IMAP_PASSWORD) {
    console.error("IMAP_USER and IMAP_PASSWORD must be set in .env (see .env.example).");
    process.exit(1);
  }

  await ensureDir(outputDir);

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: Number(IMAP_PORT),
    secure: Number(IMAP_PORT) === 993,
    auth: { user: IMAP_USER, pass: IMAP_PASSWORD },
    logger: false
  });

  await client.connect();
  console.log(`Connected to ${IMAP_HOST}:${IMAP_PORT} as ${IMAP_USER}`);

  let processed = 0;
  let savedAttachments = 0;
  let markedSeen = 0;
  const movedUids = [];
  const seenUids = [];

  try {
    const lock = await client.getMailboxLock(IMAP_FOLDER);

    try {
      const unseenUids = await client.search({ seen: false }, { uid: true });
      console.log(`Found ${unseenUids.length} unread message(s) in ${IMAP_FOLDER}.`);

      for (const uid of unseenUids) {
        const message = await client.fetchOne(uid, { source: true, uid: true }, { uid: true });

        if (!message) {
          continue;
        }

        processed += 1;
        const parsed = await simpleParser(message.source);
        const subject = parsed.subject ?? "(no subject)";
        const sender = parsed.from?.text ?? "(unknown sender)";
        console.log(`\n[${processed}] ${subject} — from ${sender}`);

        let messageSaved = 0;

        for (const attachment of parsed.attachments ?? []) {
          const ext = path.extname(attachment.filename ?? "").toLowerCase();

          if (!ALLOWED_EXTENSIONS.has(ext)) {
            console.log(`  · Skipped ${attachment.filename} (extension ${ext} not allowed)`);
            continue;
          }

          const safeName = sanitize(attachment.filename ?? `attachment${ext}`);
          const target = path.join(outputDir, `${timestamp()}__${safeName}`);
          await fs.writeFile(target, attachment.content);
          savedAttachments += 1;
          messageSaved += 1;
          console.log(`  · Saved ${target}`);
        }

        if (messageSaved === 0) {
          console.log("  · No allowed attachments in this message.");
        }

        seenUids.push(uid);

        if (IMAP_PROCESSED_FOLDER) {
          movedUids.push(uid);
        }
      }

      if (IMAP_MARK_SEEN === "true" && seenUids.length) {
        await client.messageFlagsAdd(seenUids, ["\\Seen"], { uid: true });
        markedSeen = seenUids.length;
        console.log(`\nMarked ${markedSeen} message(s) as \\Seen.`);
      }

      if (IMAP_PROCESSED_FOLDER && movedUids.length) {
        try {
          await client.messageMove(movedUids, IMAP_PROCESSED_FOLDER, { uid: true });
          console.log(`Moved ${movedUids.length} message(s) to ${IMAP_PROCESSED_FOLDER}.`);
        } catch (moveError) {
          console.warn(`Could not move messages to ${IMAP_PROCESSED_FOLDER}: ${moveError.message}`);
        }
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

  console.log(
    `\nDone. Processed ${processed} message(s), saved ${savedAttachments} attachment(s) to:\n  ${outputDir}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Email fetch failed:", error);
    process.exit(1);
  });
