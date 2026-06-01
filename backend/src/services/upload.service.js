import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

import { prisma } from "../lib/prisma.js";
import { incidentRepository } from "../repositories/incident.repository.js";
import { normalizeStoredAttachmentPath, resolveStoredAttachmentPath } from "../config/storage.js";
import { HttpError } from "../utils/http-error.js";

function trimOptionalText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

function computeAttachmentDisposition(fileName) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return `attachment; filename="${safeFileName}"`;
}

function computePreviewable(fileType) {
  return ["application/pdf", "image/jpeg", "image/png", "text/plain"].includes(fileType);
}

function buildAttachmentResponse(attachment) {
  return {
    ...attachment,
    is_previewable: computePreviewable(attachment.file_type),
    download_url: `/api/uploads/${attachment.id}/download`
  };
}

function buildAttachmentHistoryComment(attachments) {
  if (attachments.length === 1) {
    return `Attachment linked: ${attachments[0].file_name}`;
  }

  return `${attachments.length} evidence files linked to the incident intake record.`;
}

async function computeChecksumSha256(absoluteFilePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(absoluteFilePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

export const uploadService = {
  async captureFile(payload, actor = "system") {
    if (!payload.file) {
      throw new HttpError(400, "Attachment file is required");
    }

    const incident = payload.incident_id ? await incidentRepository.findById(payload.incident_id) : null;

    if (payload.incident_id && !incident) {
      throw new HttpError(404, "Incident for attachment not found");
    }

    const absoluteFilePath = payload.file.path;
    const checksumSha256 = await computeChecksumSha256(absoluteFilePath);
    const timestamp = new Date();
    const nextStatus = payload.incident_id ? "LINKED" : "STAGED";
    const filePath = normalizeStoredAttachmentPath(absoluteFilePath);

    const attachment = await prisma.$transaction(async (client) => {
      const createdAttachment = await incidentRepository.addAttachment(
        {
          incident_id: payload.incident_id ?? null,
          file_name: payload.file.originalname,
          storage_name: payload.file.filename,
          file_path: filePath,
          file_type: payload.file.mimetype,
          file_extension: path.extname(payload.file.originalname).toLowerCase(),
          source_type: payload.source_type ?? incident?.source_type ?? "MANUAL_UPLOAD",
          source_label: trimOptionalText(payload.source_label),
          intake_reference: trimOptionalText(payload.intake_reference),
          notes: trimOptionalText(payload.notes),
          ingestion_status: nextStatus,
          checksum_sha256: checksumSha256,
          uploaded_by: actor,
          uploaded_at: timestamp,
          linked_at: payload.incident_id ? timestamp : null,
          size_bytes: payload.file.size
        },
        client
      );

      if (payload.incident_id) {
        await incidentRepository.addHistory(
          {
            incident_id: payload.incident_id,
            old_status: incident.status,
            new_status: incident.status,
            changed_by: actor,
            action: "ATTACHMENT_LINKED",
            comment: trimOptionalText(payload.notes) ?? `Attachment linked: ${payload.file.originalname}`,
            changed_at: timestamp
          },
          client
        );
      }

      return createdAttachment;
    });

    return {
      attachment: buildAttachmentResponse(attachment),
      linked_to_incident: Boolean(payload.incident_id),
      intake_contract: {
        attachment_id: attachment.id,
        source_type: attachment.source_type,
        ingestion_status: attachment.ingestion_status,
        download_endpoint: `/api/uploads/${attachment.id}/download`
      }
    };
  },

  async listStagedEvidence(actor, filters) {
    const items = await incidentRepository.listStagedAttachments({
      uploadedBy: actor,
      sourceType: filters.source_type,
      limit: filters.limit
    });

    return {
      items: items.map(buildAttachmentResponse)
    };
  },

  async linkAttachmentsToIncident(incidentId, attachmentIds = [], actor = "system", client = prisma) {
    const uniqueAttachmentIds = [...new Set((attachmentIds ?? []).map((item) => String(item).trim()).filter(Boolean))];

    if (!uniqueAttachmentIds.length) {
      return [];
    }

    const attachments = await incidentRepository.listAttachmentsByIds(uniqueAttachmentIds);

    if (attachments.length !== uniqueAttachmentIds.length) {
      throw new HttpError(404, "One or more staged evidence files were not found");
    }

    const conflictingAttachment = attachments.find(
      (attachment) => attachment.incident_id && attachment.incident_id !== incidentId
    );

    if (conflictingAttachment) {
      throw new HttpError(400, `Attachment ${conflictingAttachment.file_name} is already linked to another incident`);
    }

    const timestamp = new Date();
    const linkedAttachments = await incidentRepository.linkAttachments(
      uniqueAttachmentIds,
      {
        incident_id: incidentId,
        ingestion_status: "LINKED",
        linked_at: timestamp
      },
      client
    );

    await incidentRepository.addHistory(
      {
        incident_id: incidentId,
        old_status: null,
        new_status: null,
        changed_by: actor,
        action: "ATTACHMENTS_LINKED",
        comment: buildAttachmentHistoryComment(linkedAttachments),
        changed_at: timestamp
      },
      client
    );

    return linkedAttachments.map(buildAttachmentResponse);
  },

  async getAttachmentDownload(id) {
    const attachment = await incidentRepository.findAttachmentById(id);

    if (!attachment) {
      throw new HttpError(404, "Attachment not found");
    }

    const absolutePath = resolveStoredAttachmentPath(attachment.file_path);

    if (!fs.existsSync(absolutePath)) {
      throw new HttpError(404, "Attachment file is no longer available in storage");
    }

    return {
      attachment: buildAttachmentResponse(attachment),
      absolutePath,
      contentDisposition: computeAttachmentDisposition(attachment.file_name)
    };
  }
};
