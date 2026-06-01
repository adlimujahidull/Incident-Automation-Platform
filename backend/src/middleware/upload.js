import path from "node:path";
import { randomUUID } from "node:crypto";

import multer from "multer";

import { ensureUploadDirectory } from "../config/storage.js";
import { HttpError } from "../utils/http-error.js";

const allowedFileDefinitions = {
  ".pdf": new Set(["application/pdf"]),
  ".docx": new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
  ".jpg": new Set(["image/jpeg"]),
  ".jpeg": new Set(["image/jpeg"]),
  ".png": new Set(["image/png"]),
  ".txt": new Set(["text/plain"])
};

function getFileExtension(file) {
  return path.extname(file.originalname).toLowerCase();
}

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    const now = new Date();
    const partition = path.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"));
    callback(null, ensureUploadDirectory(partition));
  },
  filename: (_request, file, callback) => {
    callback(null, `${Date.now()}-${randomUUID()}${getFileExtension(file)}`);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    const fileExtension = getFileExtension(file);
    const allowedMimeTypes = allowedFileDefinitions[fileExtension];

    if (!allowedMimeTypes || !allowedMimeTypes.has(file.mimetype)) {
      callback(
        new HttpError(
          400,
          "Unsupported file type. Allowed formats: PDF, DOCX, PNG, JPG, JPEG, and TXT with matching MIME type."
        )
      );
      return;
    }

    callback(null, true);
  }
});
