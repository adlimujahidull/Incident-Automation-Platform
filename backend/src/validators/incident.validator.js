import { z } from "zod";

import { aiApplicableFields } from "../constants/ai.constants.js";
import {
  incidentCategories,
  incidentDepartments,
  incidentPriorities,
  incidentStatuses,
  sourceTypes
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

const optionalDateString = z.preprocess(emptyStringToUndefined, z.string().datetime({ offset: true }).optional());

export const listIncidentsQuerySchema = z
  .object({
    query: z.preprocess(emptyStringToUndefined, z.string().max(120).optional()),
    status: z.preprocess(csvToArray, z.array(z.enum(incidentStatuses)).optional()),
    priority: z.preprocess(csvToArray, z.array(z.enum(incidentPriorities)).optional()),
    category: z.preprocess(csvToArray, z.array(z.enum(incidentCategories)).optional()),
    department: z.preprocess(csvToArray, z.array(z.enum(incidentDepartments)).optional()),
    source_type: z.preprocess(csvToArray, z.array(z.enum(sourceTypes)).optional()),
    assignee: z.preprocess(emptyStringToUndefined, z.string().max(80).optional()),
    tags: z.preprocess(csvToArray, z.array(z.string().min(1).max(32)).max(8).optional()),
    creator: z.preprocess(emptyStringToUndefined, z.string().max(120).optional()),
    bucket: z.preprocess(
      emptyStringToUndefined,
      z.enum(["active", "unresolved", "critical", "duplicates", "rejected", "closed"]).optional()
    ),
    from: optionalDateString,
    to: optionalDateString,
    page: z.preprocess(
      (value) => (value === undefined || value === null || value === "" ? 1 : Number(value)),
      z.number().int().min(1).max(1000)
    ),
    pageSize: z.preprocess(
      (value) => (value === undefined || value === null || value === "" ? 25 : Number(value)),
      z.number().int().min(1).max(100)
    ),
    sortBy: z.preprocess(
      emptyStringToUndefined,
      z.enum(["created_at", "updated_at", "priority", "status", "incident_code", "title"]).optional()
    ),
    sortDir: z.preprocess(emptyStringToUndefined, z.enum(["asc", "desc"]).optional())
  })
  .strict();

const baseIncidentSchema = {
  title: z.string().min(5).max(120),
  summary: z.string().min(20).max(2500),
  category: z.enum(incidentCategories),
  priority: z.enum(incidentPriorities),
  source_type: z.enum(sourceTypes),
  assigned_department: z.enum(incidentDepartments),
  tags: z.array(z.string().min(2).max(32)).max(8).optional(),
  suggested_action: z.string().max(500).optional()
};

export const createIncidentSchema = z.object({
  ...baseIncidentSchema,
  attachment_ids: z.array(z.string().min(1)).max(8).optional()
});

export const updateIncidentSchema = z.object({
  title: baseIncidentSchema.title.optional(),
  summary: baseIncidentSchema.summary.optional(),
  category: baseIncidentSchema.category.optional(),
  priority: baseIncidentSchema.priority.optional(),
  source_type: baseIncidentSchema.source_type.optional(),
  assigned_department: baseIncidentSchema.assigned_department.optional(),
  tags: baseIncidentSchema.tags,
  suggested_action: baseIncidentSchema.suggested_action
});

export const updateIncidentStatusSchema = z.object({
  status: z.enum(incidentStatuses),
  comment: z.string().max(400).optional(),
  duplicate_of: z.string().optional(),
  duplicate_of_incident_code: z.string().max(40).optional()
});

export const assignIncidentSchema = z.object({
  assigned_to_user_id: z.string().min(1),
  assigned_department: z.enum(incidentDepartments).optional(),
  comment: z.string().max(400).optional()
});

export const addIncidentCommentSchema = z.object({
  body: z.string().min(4).max(1000)
});

export const applyAiAnalysisSchema = z.object({
  fields: z.array(z.enum(aiApplicableFields)).min(1).max(aiApplicableFields.length)
});

export const archiveIncidentSchema = z.object({
  reason: z.string().min(4).max(400)
});
