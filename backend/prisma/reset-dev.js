import fs from "node:fs/promises";
import path from "node:path";

import { uploadsRootDirectory } from "../src/config/storage.js";
import { prisma, runSeed } from "./seed.js";

async function resetDevelopmentData() {
  const uploadEntries = await fs.readdir(uploadsRootDirectory, { withFileTypes: true }).catch(() => []);

  await Promise.all(
    uploadEntries
      .filter((entry) => entry.name !== ".gitkeep")
      .map((entry) =>
        fs.rm(path.join(uploadsRootDirectory, entry.name), { recursive: true, force: true }).catch(() => undefined)
      )
  );

  await prisma.automationLog.deleteMany();
  await prisma.uiPathJob.deleteMany();
  await prisma.incidentComment.deleteMany();
  await prisma.incidentHistory.deleteMany();
  await prisma.incidentAttachment.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.user.deleteMany();

  await runSeed();
}

resetDevelopmentData()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
