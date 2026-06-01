import { z } from "zod";

import {
  automationResults,
  incidentCategories,
  incidentDepartments,
  incidentPriorities,
  incidentStatuses,
  uipathJobStatuses,
  uipathSourceChannels
} from "../constants/incident.constants.js";

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

const jsonRecordSchema = z.record(z.unknown());
const optionalTrimmedString = (max) => z.preprocess(emptyStringToUndefined, z.string().max(max).optional());

const intakeIncidentSchema = z.object({
  title: z.string().min(5).max(180),
  summary: z.string().min(20).max(4000),
  category: z.enum(incidentCategories),
  priority: z.enum(incidentPriorities),
  assigned_department: z.enum(incidentDepartments),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  suggested_action: optionalTrimmedString(1200),
  attachment_ids: z.array(z.string().min(1)).max(12).optional(),
  created_by: optionalTrimmedString(120),
  status: z.enum(["NEW", "PROCESSING", "OPEN", "FAILED"]).optional(),
  notes: optionalTrimmedString(500)
});

export const listUiPathJobsQuerySchema = z
  .object({
    query: optionalTrimmedString(160),
    status: z.preprocess(csvToArray, z.array(z.enum(uipathJobStatuses)).optional()),
    source_channel: z.preprocess(csvToArray, z.array(z.enum(uipathSourceChannels)).optional()),
    related_incident_id: optionalTrimmedString(80),
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

export const createUiPathIntakeSchema = z
  .object({
    job_reference: z.string().min(3).max(120),
    process_name: z.string().min(3).max(120),
    source_channel: z.enum(uipathSourceChannels),
    source_reference: optionalTrimmedString(180),
    create_incident: z.boolean().optional(),
    incident: intakeIncidentSchema.optional(),
    extracted_text: optionalTrimmedString(8000),
    summary_report: optionalTrimmedString(3000),
    payload_snapshot: jsonRecordSchema.optional(),
    result_payload: jsonRecordSchema.optional(),
    retry_attempts: z.number().int().min(0).max(10).optional(),
    failure_reason: optionalTrimmedString(1200),
    screenshot_path: optionalTrimmedString(240),
    content_hash: optionalTrimmedString(128)
  })
  .superRefine((value, context) => {
    const shouldCreate = value.create_incident ?? Boolean(value.incident);

    if (shouldCreate && !value.incident && !value.extracted_text) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["incident"],
        message: "Either incident payload or extracted_text is required when create_incident is enabled"
      });
    }
  });

export const duplicateCheckSchema = z.object({
  content_hash: z.string().min(8).max(128),
  source_channel: z.enum(uipathSourceChannels).optional(),
  source_reference: optionalTrimmedString(180),
  window_days: z.number().int().min(1).max(60).optional()
});

export const recordRunSummarySchema = z.object({
  job_reference: z.string().min(3).max(120),
  process_name: z.string().min(3).max(120),
  source_channel: z.enum(uipathSourceChannels),
  totals: z.object({
    created: z.number().int().min(0),
    updated: z.number().int().min(0),
    duplicates: z.number().int().min(0),
    failed: z.number().int().min(0)
  }),
  summary_report: z.string().min(20).max(6000),
  log_excerpt: optionalTrimmedString(8000),
  email_target: optionalTrimmedString(160),
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional()
});

export const updateUiPathJobStatusSchema = z.object({
  status: z.enum(uipathJobStatuses),
  result: z.enum(automationResults).optional(),
  retry_attempts: z.number().int().min(0).max(10).optional(),
  failure_reason: optionalTrimmedString(1200),
  screenshot_path: optionalTrimmedString(240),
  result_payload: jsonRecordSchema.optional(),
  summary_report: optionalTrimmedString(3000),
  incident_status: z.enum(incidentStatuses).optional(),
  incident_comment: optionalTrimmedString(600),
  last_callback_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional()
});
