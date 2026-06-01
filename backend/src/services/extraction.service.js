import fs from "node:fs/promises";
import { createRequire } from "node:module";

import mammoth from "mammoth";

import { resolveStoredAttachmentPath } from "../config/storage.js";
import { incidentRepository } from "../repositories/incident.repository.js";
import { aiService } from "./ai.service.js";
import { HttpError } from "../utils/http-error.js";

const requireFromHere = createRequire(import.meta.url);

async function extractFromPdf(absolutePath) {
  const { PDFParse } = requireFromHere("pdf-parse");
  const buffer = await fs.readFile(absolutePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return (result.text ?? "").trim();
}

async function extractFromDocx(absolutePath) {
  const buffer = await fs.readFile(absolutePath);
  const result = await mammoth.extractRawText({ buffer });
  return (result.value ?? "").trim();
}

async function extractFromTxt(absolutePath) {
  const buffer = await fs.readFile(absolutePath);
  return buffer.toString("utf8").trim();
}

const EXTRACTORS = {
  ".pdf": extractFromPdf,
  ".docx": extractFromDocx,
  ".txt": extractFromTxt
};

export const extractionService = {
  isExtractable(extension) {
    return Boolean(EXTRACTORS[String(extension ?? "").toLowerCase()]);
  },

  async extractFromAttachment(attachmentId) {
    const attachment = await incidentRepository.findAttachmentById(attachmentId);

    if (!attachment) {
      throw new HttpError(404, "Attachment not found");
    }

    const extension = (attachment.file_extension ?? "").toLowerCase();
    const extractor = EXTRACTORS[extension];

    if (!extractor) {
      throw new HttpError(400, `Extraction is not supported for ${extension || "this file type"}`);
    }

    const absolutePath = resolveStoredAttachmentPath(attachment.file_path);

    let extractedText = "";
    let extractionError = null;

    try {
      extractedText = await extractor(absolutePath);
    } catch (error) {
      extractionError = error.message;
    }

    if (extractionError) {
      throw new HttpError(422, `Extraction failed: ${extractionError}`);
    }

    if (!extractedText) {
      throw new HttpError(422, "No text content could be recovered from this file");
    }

    const draft = aiService.buildSeedFromText(extractedText, {
      source_type: attachment.source_type ?? "MANUAL_UPLOAD"
    });

    return {
      attachment_id: attachment.id,
      file_name: attachment.file_name,
      file_extension: extension,
      extracted_text: extractedText.slice(0, 20000),
      character_count: extractedText.length,
      draft
    };
  }
};
