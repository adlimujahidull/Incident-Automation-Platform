import { z } from "zod";

import { sourceTypes } from "../constants/incident.constants.js";

function emptyStringToUndefined(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
}

function optionalString(maxLength) {
  return z.preprocess(emptyStringToUndefined, z.string().max(maxLength).optional());
}

export const createUploadSchema = z.object({
  incident_id: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  source_type: z.preprocess(emptyStringToUndefined, z.enum(sourceTypes).optional()),
  source_label: optionalString(80),
  intake_reference: optionalString(120),
  notes: optionalString(500)
});

export const listUploadsQuerySchema = z.object({
  source_type: z.preprocess(emptyStringToUndefined, z.enum(sourceTypes).optional()),
  limit: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") {
        return 12;
      }

      return Number(value);
    },
    z.number().int().min(1).max(25)
  )
});
