import { ImapFlow } from "imapflow";
import "dotenv/config";

const { IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD } = process.env;

const client = new ImapFlow({
  host: IMAP_HOST,
  port: Number(IMAP_PORT),
  secure: Number(IMAP_PORT) === 993,
  auth: { user: IMAP_USER, pass: IMAP_PASSWORD },
  logger: false
});

await client.connect();

const targetUids = process.argv.slice(2).map((v) => Number(v)).filter(Boolean);

if (!targetUids.length) {
  console.error("Usage: node debug-inbox.mjs <uid1> <uid2> ...");
  await client.logout().catch(() => {});
  client.close();
  process.exit(1);
}

const lock = await client.getMailboxLock("INBOX");
try {
  await client.messageFlagsRemove(targetUids, ["\\Seen"], { uid: true });
  console.log(`Unmarked \\Seen on UIDs ${targetUids.join(", ")}`);
} finally {
  lock.release();
}

await Promise.race([client.logout(), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
client.close();
process.exit(0);
