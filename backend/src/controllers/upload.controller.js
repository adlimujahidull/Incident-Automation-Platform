import fs from "node:fs/promises";

import { HttpError } from "../utils/http-error.js";
import { createUploadSchema } from "../validators/upload.validator.js";
import { uploadService } from "../services/upload.service.js";
import { extractionService } from "../services/extraction.service.js";

async function cleanupUploadedFile(file) {
  if (!file?.path) {
    return;
  }

  try {
    await fs.unlink(file.path);
  } catch {
    // Best-effort cleanup only. Missing temp files should not mask the original error.
  }
}

function mapValidationIssues(issues) {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));
}

export const uploadController = {
  async list(request, response) {
    const result = await uploadService.listStagedEvidence(request.user?.email ?? "system", request.query);
    response.json(result);
  },

  async upload(request, response) {
    const payloadResult = createUploadSchema.safeParse(request.body);

    if (!payloadResult.success) {
      await cleanupUploadedFile(request.file);

      throw new HttpError(400, "Validation failed", mapValidationIssues(payloadResult.error.issues));
    }

    try {
      const result = await uploadService.captureFile(
        {
          ...payloadResult.data,
          file: request.file
        },
        request.user?.email ?? "system"
      );

      response.status(201).json({
        message: result.linked_to_incident
          ? "Attachment linked to incident evidence register"
          : "Evidence file staged for incident intake",
        ...result
      });
    } catch (error) {
      await cleanupUploadedFile(request.file);
      throw error;
    }
  },

  async download(request, response) {
    const result = await uploadService.getAttachmentDownload(request.params.id);

    response.setHeader("Content-Type", result.attachment.file_type);
    response.setHeader("Content-Length", String(result.attachment.size_bytes));
    response.setHeader("Content-Disposition", result.contentDisposition);
    response.sendFile(result.absolutePath);
  },

  async extract(request, response) {
    const result = await extractionService.extractFromAttachment(request.params.id);
    response.json(result);
  },

  async machineUpload(request, response) {
    const payloadResult = createUploadSchema.safeParse(request.body);

    if (!payloadResult.success) {
      await cleanupUploadedFile(request.file);
      throw new HttpError(400, "Validation failed", mapValidationIssues(payloadResult.error.issues));
    }

    try {
      const actor = `uipath:${request.body.process_name ?? "bot"}`;
      const result = await uploadService.captureFile(
        {
          ...payloadResult.data,
          source_type: payloadResult.data.source_type ?? "RPA",
          file: request.file
        },
        actor
      );

      response.status(201).json(result);
    } catch (error) {
      await cleanupUploadedFile(request.file);
      throw error;
    }
  },

  async machineExtract(request, response) {
    const result = await extractionService.extractFromAttachment(request.params.id);
    response.json(result);
  }
};
