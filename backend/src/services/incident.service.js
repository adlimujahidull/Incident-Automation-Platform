import {
  duplicateWindowDays,
  incidentCategories,
  incidentDepartments,
  incidentPriorities,
  incidentStatuses,
  sourceTypes,
  workflowTransitions
} from "../constants/incident.constants.js";
import { prisma } from "../lib/prisma.js";
import { incidentRepository } from "../repositories/incident.repository.js";
import { HttpError } from "../utils/http-error.js";
import { normalizeText, tokenize } from "../utils/slugify.js";
import { aiService } from "./ai.service.js";
import { uploadService } from "./upload.service.js";
import { userService } from "./user.service.js";

function generateIncidentCode(sequence) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INC-${date}-${String(sequence).padStart(4, "0")}`;
}

function scoreSimilarity(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return overlap / union;
}

async function detectDuplicate(candidate) {
  const recentIncidents = await incidentRepository.listRecent(duplicateWindowDays);
  const candidateText = `${candidate.title} ${candidate.summary}`;

  return recentIncidents.find((existing) => {
    const exactTitleMatch = normalizeText(existing.title) === normalizeText(candidate.title);
    const exactSummaryMatch = normalizeText(existing.summary) === normalizeText(candidate.summary);
    const similarity = scoreSimilarity(candidateText, `${existing.title} ${existing.summary}`);

    return exactTitleMatch || exactSummaryMatch || similarity >= 0.72;
  });
}

function assertTransition(currentStatus, nextStatus) {
  if (!incidentStatuses.includes(nextStatus)) {
    throw new HttpError(400, "Unknown workflow status");
  }

  const allowedTransitions = workflowTransitions[currentStatus] ?? [];

  if (!allowedTransitions.includes(nextStatus)) {
    throw new HttpError(400, `Status transition from ${currentStatus} to ${nextStatus} is not allowed`);
  }
}

function buildHistoryEntry({ incidentId, oldStatus, newStatus, changedBy, action, comment }) {
  return {
    incident_id: incidentId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy ?? "system",
    action,
    comment: comment ?? null,
    changed_at: new Date()
  };
}

function buildDepartmentWorkload(groupedRows) {
  const lookup = new Map();

  for (const row of groupedRows) {
    const key = row.assigned_department;
    if (!lookup.has(key)) {
      lookup.set(key, { open: 0, in_review: 0, resolved: 0, other: 0, total: 0 });
    }

    const counts = lookup.get(key);
    const count = row._count?._all ?? 0;
    counts.total += count;

    if (row.status === "OPEN" || row.status === "ASSIGNED" || row.status === "NEW" || row.status === "PROCESSING") {
      counts.open += count;
    } else if (row.status === "IN REVIEW") {
      counts.in_review += count;
    } else if (row.status === "RESOLVED" || row.status === "CLOSED") {
      counts.resolved += count;
    } else {
      counts.other += count;
    }
  }

  return incidentDepartments.map((department) => ({
    department,
    ...(lookup.get(department) ?? { open: 0, in_review: 0, resolved: 0, other: 0, total: 0 })
  }));
}

function startOfUtcDay(date) {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function formatUtcDay(date) {
  return date.toISOString().slice(0, 10);
}

function buildTrendSeries(createdRows, resolvedHistory, days = 14) {
  const today = startOfUtcDay(new Date());
  const series = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - offset);
    series.push({ date: formatUtcDay(day), created: 0, resolved: 0 });
  }

  const indexByDate = new Map(series.map((entry, index) => [entry.date, index]));

  for (const row of createdRows) {
    const dayKey = formatUtcDay(startOfUtcDay(row.created_at));
    const index = indexByDate.get(dayKey);
    if (index !== undefined) {
      series[index].created += 1;
    }
  }

  for (const row of resolvedHistory) {
    const dayKey = formatUtcDay(startOfUtcDay(row.changed_at));
    const index = indexByDate.get(dayKey);
    if (index !== undefined) {
      series[index].resolved += 1;
    }
  }

  return series;
}

function mapGroupedCount(rows, key, ordering) {
  const lookup = new Map(rows.map((row) => [row[key], row._count?._all ?? 0]));
  if (ordering) {
    return ordering.map((label) => ({ [key]: label, count: lookup.get(label) ?? 0 }));
  }

  return rows.map((row) => ({ [key]: row[key], count: row._count?._all ?? 0 }));
}

function getStatusActionName(currentStatus, nextStatus) {
  if (nextStatus === "DUPLICATE") {
    return "MARKED_DUPLICATE";
  }

  if (nextStatus === "REJECTED") {
    return "INCIDENT_REJECTED";
  }

  if (nextStatus === "FAILED") {
    return "INCIDENT_FAILED";
  }

  if (nextStatus === "RESOLVED") {
    return "INCIDENT_RESOLVED";
  }

  if (nextStatus === "PROCESSING" && currentStatus === "FAILED") {
    return "FAILURE_RECOVERY_STARTED";
  }

  if (nextStatus === "OPEN" && ["FAILED", "RESOLVED", "IN REVIEW"].includes(currentStatus)) {
    return "INCIDENT_REOPENED";
  }

  return "STATUS_CHANGED";
}

function getAvailableTransitions(status) {
  return workflowTransitions[status] ?? [];
}

function trimOptionalText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

async function resolveDuplicateTarget(incident, payload) {
  if (payload.status !== "DUPLICATE") {
    return null;
  }

  const duplicateTargetId = trimOptionalText(payload.duplicate_of);
  const duplicateTargetCode = trimOptionalText(payload.duplicate_of_incident_code);

  if (!duplicateTargetId && !duplicateTargetCode) {
    throw new HttpError(400, "Duplicate incidents must reference an existing incident");
  }

  const target = duplicateTargetId
    ? await incidentRepository.findById(duplicateTargetId)
    : await incidentRepository.findByIncidentCode(duplicateTargetCode);

  if (!target) {
    throw new HttpError(404, "Referenced duplicate incident was not found");
  }

  if (target.id === incident.id) {
    throw new HttpError(400, "An incident cannot be marked as a duplicate of itself");
  }

  return target;
}

function buildIncidentResponse(incident, history, attachments, comments, aiAnalyses) {
  return {
    ...incident,
    history,
    attachments,
    comments,
    ai_analyses: aiAnalyses,
    ai_runtime: aiService.getRuntimeStatus(),
    available_transitions: getAvailableTransitions(incident.status)
  };
}

export const incidentService = {
  async listIncidents(filters) {
    const result = await incidentRepository.list(filters);

    const items = result.items.map((item) => {
      const latestAi = item.ai_analyses?.[0] ?? null;
      const { ai_analyses, ...rest } = item;

      return {
        ...rest,
        latest_ai_confidence: latestAi?.confidence_score ?? null,
        latest_ai_provider: latestAi?.provider ?? null,
        latest_ai_at: latestAi?.created_at ?? null
      };
    });

    const aiPending = items.filter((item) => item.latest_ai_confidence === null).length;

    return { ...result, items, ai_pending_count: aiPending };
  },

  async getIncident(id) {
    const incident = await incidentRepository.findById(id);

    if (!incident) {
      throw new HttpError(404, "Incident not found");
    }

    const [history, attachments, comments, aiAnalyses] = await Promise.all([
      incidentRepository.listHistory(id),
      incidentRepository.listAttachments(id),
      incidentRepository.listComments(id),
      incidentRepository.listAiAnalyses(id)
    ]);

    return buildIncidentResponse(incident, history, attachments, comments, aiAnalyses);
  },

  async createIncident(payload, actor = "system") {
    const duplicate = await detectDuplicate(payload);
    const status = duplicate ? "DUPLICATE" : payload.status ?? "NEW";
    const timestamp = new Date();
    const currentCount = await incidentRepository.countAll();
    const attachmentIds = payload.attachment_ids ?? [];
    let createdIncidentId = null;

    await prisma.$transaction(async (client) => {
      const incident = await incidentRepository.create(
        {
          incident_code: generateIncidentCode(currentCount + 1),
          title: payload.title,
          summary: payload.summary,
          category: payload.category,
          priority: payload.priority,
          status,
          source_type: payload.source_type,
          assigned_department: payload.assigned_department,
          tags: payload.tags ?? [],
          suggested_action: payload.suggested_action ?? null,
          created_by: actor,
          assigned_to_user_id: null,
          assigned_at: null,
          created_at: timestamp,
          updated_at: timestamp,
          duplicate_of: duplicate?.id ?? null
        },
        client
      );

      createdIncidentId = incident.id;

      await incidentRepository.addHistory(
        buildHistoryEntry({
          incidentId: incident.id,
          oldStatus: null,
          newStatus: status,
          changedBy: actor,
          action: duplicate ? "DUPLICATE_DETECTED" : "INCIDENT_CREATED",
          comment: duplicate ? `Potential duplicate of ${duplicate.incident_code}` : "Incident captured"
        }),
        client
      );

      await uploadService.linkAttachmentsToIncident(incident.id, attachmentIds, actor, client);
    });

    return this.getIncident(createdIncidentId);
  },

  async updateIncident(id, payload, actor = "system") {
    const incident = await incidentRepository.findById(id);

    if (!incident) {
      throw new HttpError(404, "Incident not found");
    }

    const trackedFields = [
      "title",
      "summary",
      "category",
      "priority",
      "source_type",
      "assigned_department",
      "tags",
      "suggested_action"
    ];

    const changedFields = trackedFields.filter((field) => {
      if (!(field in payload)) {
        return false;
      }

      const before = incident[field];
      const after = payload[field];

      if (Array.isArray(before) || Array.isArray(after)) {
        return JSON.stringify(before ?? []) !== JSON.stringify(after ?? []);
      }

      return (before ?? null) !== (after ?? null);
    });

    if (!changedFields.length) {
      return this.getIncident(id);
    }

    const previousStatus = incident.status;
    await incidentRepository.update(id, {
      ...payload,
      updated_at: new Date()
    });

    await incidentRepository.addHistory(
      buildHistoryEntry({
        incidentId: id,
        oldStatus: previousStatus,
        newStatus: previousStatus,
        changedBy: actor,
        action: "INCIDENT_UPDATED",
        comment: `Fields updated: ${changedFields.join(", ")}`
      })
    );

    return this.getIncident(id);
  },

  async assignIncident(id, payload, actor = "system") {
    const incident = await incidentRepository.findById(id);

    if (!incident) {
      throw new HttpError(404, "Incident not found");
    }

    const assignee = await userService.findUserById(payload.assigned_to_user_id);

    if (!assignee) {
      throw new HttpError(404, "Assigned user was not found");
    }

    const previousStatus = incident.status;
    const terminalStatuses = new Set(["CLOSED", "REJECTED", "DUPLICATE"]);

    if (terminalStatuses.has(incident.status)) {
      throw new HttpError(400, `Incidents in ${incident.status} must be reopened before reassignment`);
    }

    const nextStatus =
      incident.status === "NEW" || incident.status === "PROCESSING" || incident.status === "OPEN"
        ? "ASSIGNED"
        : incident.status;

    if (nextStatus === "ASSIGNED" && incident.status !== "ASSIGNED") {
      assertTransition(incident.status, "ASSIGNED");
    }

    const updated = await incidentRepository.update(id, {
      assigned_to_user_id: assignee.id,
      assigned_department: payload.assigned_department ?? assignee.department ?? incident.assigned_department,
      assigned_at: new Date(),
      status: nextStatus,
      updated_at: new Date()
    });

    const action =
      incident.assigned_to_user_id && incident.assigned_to_user_id !== assignee.id
        ? "INCIDENT_REASSIGNED"
        : "INCIDENT_ASSIGNED";

    await incidentRepository.addHistory(
      buildHistoryEntry({
        incidentId: id,
        oldStatus: previousStatus,
        newStatus: nextStatus,
        changedBy: actor,
        action,
        comment: trimOptionalText(payload.comment) ?? `Assigned to ${assignee.name} (${assignee.role})`
      })
    );

    return this.getIncident(updated.id);
  },

  async addComment(id, payload, actor = "system") {
    const incident = await incidentRepository.findById(id);

    if (!incident) {
      throw new HttpError(404, "Incident not found");
    }

    const body = payload.body.trim();

    await incidentRepository.addComment({
      incident_id: id,
      body,
      comment_by: actor,
      created_at: new Date()
    });

    await incidentRepository.addHistory(
      buildHistoryEntry({
        incidentId: id,
        oldStatus: incident.status,
        newStatus: incident.status,
        changedBy: actor,
        action: "COMMENT_ADDED",
        comment: body
      })
    );

    return this.getIncident(id);
  },

  async listAssignableUsers() {
    return userService.listAssignableUsers();
  },

  async updateStatus(id, payload, actor = "system") {
    const incident = await incidentRepository.findById(id);

    if (!incident) {
      throw new HttpError(404, "Incident not found");
    }

    const comment = trimOptionalText(payload.comment);
    const nextStatus = payload.status;
    const duplicateTarget = await resolveDuplicateTarget(incident, payload);

    if (["REJECTED", "FAILED"].includes(nextStatus) && !comment) {
      throw new HttpError(400, `${nextStatus} transitions require an operational note`);
    }

    if (nextStatus === "ASSIGNED" && !incident.assigned_to_user_id) {
      throw new HttpError(400, "Use the assignment action before moving an incident into ASSIGNED");
    }

    const previousStatus = incident.status;
    assertTransition(incident.status, nextStatus);

    await incidentRepository.update(id, {
      status: nextStatus,
      duplicate_of: duplicateTarget?.id ?? incident.duplicate_of ?? null,
      updated_at: new Date()
    });

    await incidentRepository.addHistory(
      buildHistoryEntry({
        incidentId: id,
        oldStatus: previousStatus,
        newStatus: nextStatus,
        changedBy: actor,
        action: getStatusActionName(previousStatus, nextStatus),
        comment:
          comment ??
          (duplicateTarget ? `Linked as duplicate of ${duplicateTarget.incident_code}` : null)
      })
    );

    return this.getIncident(id);
  },

  async attachFile(incidentId, file, actor = "system") {
    return uploadService.captureFile(
      {
        incident_id: incidentId,
        file
      },
      actor
    );
  },

  async runAiAnalysis(id, actor = "system") {
    const incident = await incidentRepository.findById(id);

    if (!incident) {
      throw new HttpError(404, "Incident not found");
    }

    const attachments = await incidentRepository.listAttachments(id);
    const recentIncidents = await incidentRepository.listRecent(duplicateWindowDays);

    try {
      const analysis = await aiService.analyzeIncident(incident, attachments, recentIncidents);

      await incidentRepository.addAiAnalysis({
        incident_id: id,
        ...analysis,
        created_by: actor,
        created_at: new Date()
      });

      await incidentRepository.addHistory(
        buildHistoryEntry({
          incidentId: id,
          oldStatus: incident.status,
          newStatus: incident.status,
          changedBy: actor,
          action: "AI_ANALYSIS_COMPLETED",
          comment: `AI analysis stored using ${analysis.provider}${analysis.model ? ` (${analysis.model})` : " fallback"}`
        })
      );
    } catch (error) {
      await incidentRepository.addAiAnalysis({
        incident_id: id,
        provider: aiService.getRuntimeStatus().provider,
        model: aiService.getRuntimeStatus().model,
        status: "FAILED",
        title_suggestion: null,
        summary_suggestion: null,
        category_suggestion: null,
        priority_suggestion: null,
        department_suggestion: null,
        tags_suggestion: [],
        suggested_action_suggestion: null,
        duplicate_candidate_id: null,
        duplicate_candidate_code: null,
        duplicate_candidate_title: null,
        duplicate_confidence: null,
        confidence_score: null,
        rationale: null,
        prompt_version: "incident-analysis-v1",
        source_snapshot: {
          incident_code: incident.incident_code
        },
        raw_response: null,
        error_message: error.message,
        created_by: actor,
        created_at: new Date()
      });

      await incidentRepository.addHistory(
        buildHistoryEntry({
          incidentId: id,
          oldStatus: incident.status,
          newStatus: incident.status,
          changedBy: actor,
          action: "AI_ANALYSIS_FAILED",
          comment: error.message
        })
      );

      throw new HttpError(502, `AI analysis could not be completed: ${error.message}`);
    }

    return this.getIncident(id);
  },

  async applyAiAnalysis(id, analysisId, payload, actor = "system") {
    const [incident, analysis] = await Promise.all([
      incidentRepository.findById(id),
      incidentRepository.findAiAnalysisById(analysisId)
    ]);

    if (!incident) {
      throw new HttpError(404, "Incident not found");
    }

    if (!analysis || analysis.incident_id !== id) {
      throw new HttpError(404, "AI analysis record not found for this incident");
    }

    if (analysis.status !== "COMPLETED") {
      throw new HttpError(400, "Only completed AI analyses can be applied");
    }

    const { patch, appliedFields } = aiService.buildPatchFromAnalysis(analysis, payload.fields);

    if (!appliedFields.length) {
      throw new HttpError(400, "No applicable AI suggestions were selected");
    }

    await incidentRepository.update(id, {
      ...patch,
      updated_at: new Date()
    });

    await incidentRepository.addHistory(
      buildHistoryEntry({
        incidentId: id,
        oldStatus: incident.status,
        newStatus: incident.status,
        changedBy: actor,
        action: "AI_SUGGESTIONS_APPLIED",
        comment: `Applied AI suggestions: ${appliedFields.join(", ")}`
      })
    );

    return this.getIncident(id);
  },

  async archiveIncident(id, payload, actor = "system") {
    const incident = await incidentRepository.findById(id);

    if (!incident) {
      throw new HttpError(404, "Incident not found");
    }

    const reason = trimOptionalText(payload?.reason);

    if (!reason) {
      throw new HttpError(400, "An operational reason is required to archive an incident");
    }

    if (incident.status === "REJECTED" && incident.tags?.includes("archived")) {
      return {
        ...this.buildArchivedSummary(incident),
        archived: true,
        idempotent: true
      };
    }

    const previousStatus = incident.status;
    const archiveTags = Array.from(new Set([...(incident.tags ?? []), "archived"])).slice(0, 12);
    const now = new Date();

    await incidentRepository.update(id, {
      status: "REJECTED",
      tags: archiveTags,
      updated_at: now
    });

    await incidentRepository.addHistory(
      buildHistoryEntry({
        incidentId: id,
        oldStatus: previousStatus,
        newStatus: "REJECTED",
        changedBy: actor,
        action: "INCIDENT_ARCHIVED",
        comment: `Archived by ${actor}. Reason: ${reason}`
      })
    );

    const archived = await incidentRepository.findById(id);

    return {
      ...this.buildArchivedSummary(archived),
      archived: true,
      idempotent: false
    };
  },

  buildArchivedSummary(incident) {
    return {
      id: incident.id,
      incident_code: incident.incident_code,
      status: incident.status,
      updated_at: incident.updated_at
    };
  },

  async getDashboardSummary() {
    const trendCutoff = new Date();
    trendCutoff.setUTCHours(0, 0, 0, 0);
    trendCutoff.setUTCDate(trendCutoff.getUTCDate() - 13);

    const [
      totals,
      statusGroup,
      priorityGroup,
      categoryGroup,
      sourceGroup,
      departmentGroup,
      createdSinceTrend,
      resolvedSinceTrend,
      recentIncidents,
      recentActivities
    ] = await Promise.all([
      incidentRepository.totalsRollup(),
      incidentRepository.countByStatus(),
      incidentRepository.countByPriority(),
      incidentRepository.countByCategory(),
      incidentRepository.countBySourceType(),
      incidentRepository.countByDepartmentAndStatus(),
      incidentRepository.listSinceCreatedAt(trendCutoff),
      incidentRepository.listSinceResolvedAt(trendCutoff),
      incidentRepository.listRecentIncidents(5),
      incidentRepository.listRecentHistory(8)
    ]);

    return {
      totals: {
        total_incidents: totals.total,
        active_incidents: totals.active,
        critical_incidents: totals.critical,
        duplicate_alerts: totals.duplicates,
        unresolved_incidents: totals.unresolved,
        awaiting_ai_incidents: totals.awaiting_ai
      },
      workflow_distribution: mapGroupedCount(statusGroup, "status", incidentStatuses),
      priority_distribution: mapGroupedCount(priorityGroup, "priority", incidentPriorities),
      category_distribution: mapGroupedCount(categoryGroup, "category", incidentCategories),
      source_distribution: mapGroupedCount(sourceGroup, "source_type", sourceTypes),
      department_workload: buildDepartmentWorkload(departmentGroup),
      trend_series: buildTrendSeries(createdSinceTrend, resolvedSinceTrend),
      recent_incidents: recentIncidents,
      recent_activities: recentActivities
    };
  },

  async getIncidentCount() {
    return incidentRepository.countAll();
  }
};
