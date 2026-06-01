import { z } from "zod";

import { automationResults, automationSourceSystems } from "../constants/incident.constants.js";

function emptyStringToUndefined(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
}

function csvToArray(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const optionalDateString = z.preprocess(emptyStringToUndefined, z.string().datetime({ offset: true }).optional());

export const createAutomationLogSchema = z.object({
  process_name: z.string().min(3).max(120),
  result: z.enum(automationResults),
  source_system: z.enum(automationSourceSystems).optional(),
  job_reference: z.string().max(120).optional(),
  event_type: z.string().max(120).optional(),
  error_message: z.string().max(500).optional(),
  screenshot_path: z.string().max(240).optional(),
  retry_attempts: z.number().int().min(0).max(10).optional(),
  payload_snapshot: z.record(z.unknown()).optional(),
  related_incident_id: z.string().min(1).optional(),
  executed_at: z.string().datetime().optional()
});

export const listAutomationLogsQuerySchema = z
  .object({
    query: z.preprocess(emptyStringToUndefined, z.string().max(120).optional()),
    result: z.preprocess(csvToArray, z.array(z.enum(automationResults)).optional()),
    source_system: z.preprocess(csvToArray, z.array(z.enum(automationSourceSystems)).optional()),
    related_incident_id: z.preprocess(emptyStringToUndefined, z.string().max(80).optional()),
    from: optionalDateString,
    to: optionalDateString,
    page: z.preprocess(
      (value) => (value === undefined || value === null || value === "" ? 1 : Number(value)),
      z.number().int().min(1).max(1000)
    ),
    pageSize: z.preprocess(
      (value) => (value === undefined || value === null || value === "" ? 25 : Number(value)),
      z.number().int().min(1).max(100)
    )
  })
  .strict();
