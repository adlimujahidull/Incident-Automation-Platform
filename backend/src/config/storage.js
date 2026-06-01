import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const uploadsRootDirectory = path.resolve(currentDirectory, "../../uploads");

fs.mkdirSync(uploadsRootDirectory, { recursive: true });

export function ensureUploadDirectory(relativePath = "") {
  const targetDirectory = path.resolve(uploadsRootDirectory, relativePath);
  fs.mkdirSync(targetDirectory, { recursive: true });
  return targetDirectory;
}

export function normalizeStoredAttachmentPath(absolutePath) {
  const relativePath = path.relative(uploadsRootDirectory, absolutePath);
  return relativePath.replace(/\\/g, "/");
}

export function resolveStoredAttachmentPath(storedPath) {
  const normalized = String(storedPath ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^uploads\//, "");
  const absolutePath = path.resolve(uploadsRootDirectory, normalized);
  const relativeToRoot = path.relative(uploadsRootDirectory, absolutePath);

  if (relativeToRoot.startsWith("..")) {
    throw new Error("Attachment path resolved outside upload storage root");
  }

  return absolutePath;
}
