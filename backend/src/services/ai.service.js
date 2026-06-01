import OpenAI from "openai";
import { z } from "zod";

import { env } from "../config/env.js";
import {
  aiApplicableFields,
  aiProviderLabels,
  aiProviders,
  aiPromptVersion,
  resolveAiProviderFromBaseUrl
} from "../constants/ai.constants.js";
import {
  duplicateWindowDays,
  incidentCategories,
  incidentDepartments,
  incidentPriorities
} from "../constants/incident.constants.js";
import { normalizeText, tokenize } from "../utils/slugify.js";

const openAIClient = env.openaiApiKey
  ? new OpenAI({
      apiKey: env.openaiApiKey,
      baseURL: env.openaiBaseUrl || undefined
    })
  : null;

const usingCustomBaseUrl = Boolean(env.openaiApiKey && env.openaiBaseUrl);
const activeProvider = env.openaiApiKey
  ? resolveAiProviderFromBaseUrl(env.openaiBaseUrl)
  : aiProviders.HEURISTIC;

const analysisSchema = z.object({
  title_suggestion: z.string().min(5).max(120),
  summary_suggestion: z.string().min(20).max(2500),
  category_suggestion: z.enum(incidentCategories),
  priority_suggestion: z.enum(incidentPriorities),
  department_suggestion: z.enum(incidentDepartments),
  tags_suggestion: z.array(z.string().min(2).max(32)).max(8),
  suggested_action_suggestion: z.string().min(10).max(500),
  duplicate_candidate_code: z.string().max(40).nullable(),
  duplicate_confidence: z.number().min(0).max(1),
  confidence_score: z.number().min(0).max(1),
  rationale: z.string().min(20).max(1500)
});

const analysisJsonSchema = {
  name: "incident_ai_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title_suggestion",
      "summary_suggestion",
      "category_suggestion",
      "priority_suggestion",
      "department_suggestion",
      "tags_suggestion",
      "suggested_action_suggestion",
      "duplicate_candidate_code",
      "duplicate_confidence",
      "confidence_score",
      "rationale"
    ],
    properties: {
      title_suggestion: { type: "string", minLength: 5, maxLength: 120 },
      summary_suggestion: { type: "string", minLength: 20, maxLength: 2500 },
      category_suggestion: { type: "string", enum: [...incidentCategories] },
      priority_suggestion: { type: "string", enum: [...incidentPriorities] },
      department_suggestion: { type: "string", enum: [...incidentDepartments] },
      tags_suggestion: {
        type: "array",
        maxItems: 8,
        items: { type: "string", minLength: 2, maxLength: 32 }
      },
      suggested_action_suggestion: { type: "string", minLength: 10, maxLength: 500 },
      duplicate_candidate_code: { type: ["string", "null"], maxLength: 40 },
      duplicate_confidence: { type: "number", minimum: 0, maximum: 1 },
      confidence_score: { type: "number", minimum: 0, maximum: 1 },
      rationale: { type: "string", minLength: 20, maxLength: 1500 }
    }
  },
  strict: true
};

const categoryKeywordMap = [
  { category: "Damaged Parcel", keywords: ["damage", "damaged", "crushed", "broken", "torn", "parcel"] },
  { category: "Late Delivery", keywords: ["late", "delay", "delayed", "delivery", "arrive", "overdue"] },
  { category: "Address Issue", keywords: ["address", "postcode", "zip", "wrong location", "recipient"] },
  { category: "Customer Complaint", keywords: ["complaint", "refund", "customer", "escalation", "unhappy"] },
  { category: "Warehouse Delay", keywords: ["warehouse", "sortation", "dock", "holding", "backlog"] },
  { category: "Tracking Failure", keywords: ["tracking", "scan", "event", "handoff", "missing update"] },
  { category: "System Error", keywords: ["system", "api", "error", "timeout", "sync", "ocr", "failure"] }
];

const categoryToDepartment = {
  "Damaged Parcel": "Warehouse",
  "Late Delivery": "Delivery Operations",
  "Address Issue": "Customer Support",
  "Customer Complaint": "Customer Support",
  "Warehouse Delay": "Warehouse",
  "Tracking Failure": "Technical Support",
  "System Error": "Technical Support"
};

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

function titleCase(value) {
  return String(value)
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function summarizeText(value, maxLength = 320) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function detectCategoryFromKeywords(text, incident) {
  const normalized = normalizeText(text);

  if (
    normalized.includes("ocr") ||
    normalized.includes("extraction failed") ||
    (incident.source_type === "RPA" && normalized.includes("failed"))
  ) {
    return "System Error";
  }

  if (normalized.includes("tracking") || normalized.includes("scan") || normalized.includes("handoff")) {
    return "Tracking Failure";
  }

  if (normalized.includes("damage") || normalized.includes("damaged") || normalized.includes("crushed")) {
    return "Damaged Parcel";
  }

  if (normalized.includes("warehouse") && normalized.includes("delay")) {
    return "Warehouse Delay";
  }

  let bestMatch = categoryKeywordMap[0];
  let bestScore = -1;

  for (const entry of categoryKeywordMap) {
    const score = entry.keywords.reduce((count, keyword) => count + (normalized.includes(keyword) ? 1 : 0), 0);

    if (score > bestScore) {
      bestMatch = entry;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestMatch.category : "Customer Complaint";
}

function detectPriority(text, incident) {
  const normalized = normalizeText(text);

  if (["critical", "urgent", "system down", "compensation", "escalation"].some((keyword) => normalized.includes(keyword))) {
    return "Critical";
  }

  if (incident.category === "Damaged Parcel" || normalized.includes("damage") || normalized.includes("missing")) {
    return "High";
  }

  if (incident.category === "Tracking Failure" || incident.category === "Late Delivery") {
    return "Medium";
  }

  return "Low";
}

function detectTags(text, incident) {
  const candidateTokens = tokenize(text).filter((token) => token.length >= 4);
  const uniqueTokens = [...new Set(candidateTokens)];
  const seededTags = incident.tags ?? [];
  const merged = [...new Set([...seededTags, ...uniqueTokens.slice(0, Math.max(0, 8 - seededTags.length))])];

  return merged.slice(0, 8);
}

function suggestAction(category, department) {
  const actions = {
    "Damaged Parcel": "Validate evidence, contact warehouse operations, and prepare compensation handling if damage is confirmed.",
    "Late Delivery": "Check route and handoff status, then coordinate delivery operations for recovery ETA.",
    "Address Issue": "Verify address data with customer support and stop further routing until correction is confirmed.",
    "Customer Complaint": "Review complaint context, confirm customer impact, and assign a response owner in customer support.",
    "Warehouse Delay": "Review warehouse queue conditions and confirm whether manual intervention is needed to clear the backlog.",
    "Tracking Failure": "Investigate scan synchronization and confirm whether technical support needs to reconcile missing events.",
    "System Error": "Validate system logs, isolate the failing integration, and route technical remediation to the appropriate team."
  };

  return actions[category] ?? `Route to ${department} for manual review and structured follow-up.`;
}

function buildDuplicateSuggestion(incident, candidateIncidents) {
  const candidateText = `${incident.title} ${incident.summary}`;
  const scored = candidateIncidents
    .map((candidate) => ({
      id: candidate.id,
      incident_code: candidate.incident_code,
      title: candidate.title,
      score: scoreSimilarity(candidateText, `${candidate.title} ${candidate.summary}`)
    }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];

  if (!best || best.score < 0.55) {
    return {
      duplicate_candidate_id: null,
      duplicate_candidate_code: null,
      duplicate_candidate_title: null,
      duplicate_confidence: 0.18
    };
  }

  return {
    duplicate_candidate_id: best.id,
    duplicate_candidate_code: best.incident_code,
    duplicate_candidate_title: best.title,
    duplicate_confidence: Number(best.score.toFixed(2))
  };
}

function buildSourceSnapshot(incident, attachments, candidateIncidents) {
  return {
    incident: {
      id: incident.id,
      incident_code: incident.incident_code,
      title: incident.title,
      summary: incident.summary,
      category: incident.category,
      priority: incident.priority,
      source_type: incident.source_type,
      assigned_department: incident.assigned_department,
      tags: incident.tags ?? []
    },
    attachments: attachments.map((attachment) => ({
      file_name: attachment.file_name,
      file_type: attachment.file_type,
      source_type: attachment.source_type,
      source_label: attachment.source_label,
      notes: attachment.notes
    })),
    candidate_duplicates: candidateIncidents.map((candidate) => ({
      incident_code: candidate.incident_code,
      title: candidate.title,
      summary: summarizeText(candidate.summary, 220),
      category: candidate.category,
      priority: candidate.priority,
      status: candidate.status
    }))
  };
}

function buildHeuristicAnalysis(incident, attachments, candidateIncidents) {
  const text = `${incident.title} ${incident.summary} ${(incident.tags ?? []).join(" ")}`;
  const category = detectCategoryFromKeywords(text, incident);
  const duplicate = buildDuplicateSuggestion(incident, candidateIncidents);
  const department = categoryToDepartment[category] ?? incident.assigned_department;

  return {
    provider: aiProviders.HEURISTIC,
    model: null,
    status: "COMPLETED",
    title_suggestion: titleCase(summarizeText(incident.title, 110)),
    summary_suggestion: summarizeText(incident.summary, 420),
    category_suggestion: category,
    priority_suggestion: detectPriority(text, { ...incident, category }),
    department_suggestion: department,
    tags_suggestion: detectTags(text, incident),
    suggested_action_suggestion: suggestAction(category, department),
    duplicate_candidate_id: duplicate.duplicate_candidate_id,
    duplicate_candidate_code: duplicate.duplicate_candidate_code,
    duplicate_candidate_title: duplicate.duplicate_candidate_title,
    duplicate_confidence: duplicate.duplicate_confidence,
    confidence_score: duplicate.duplicate_candidate_code ? 0.64 : 0.56,
    rationale:
      "Generated through heuristic fallback because no live AI provider is configured. Suggestions combine keyword routing, existing incident context, and lexical duplicate scoring.",
    prompt_version: aiPromptVersion,
    source_snapshot: buildSourceSnapshot(incident, attachments, candidateIncidents),
    raw_response: {
      mode: "heuristic-fallback"
    },
    error_message: null
  };
}

function stripJsonFence(value) {
  if (!value) {
    return "";
  }

  const text = String(value).trim();
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  return text;
}

function extractJsonObject(value) {
  const cleaned = stripJsonFence(value);

  if (cleaned.startsWith("{")) {
    return cleaned;
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function buildPromptMessages(sourceSnapshot) {
  return [
    {
      role: "system",
      content: [
        "You are an enterprise logistics incident triage analyst for DHL operations.",
        "Produce structured suggestions only — never modify the human-owned incident fields.",
        "Respond with a single JSON object that conforms exactly to the provided schema.",
        "Use category, priority, and department values strictly from the allowed enums.",
        "Only return a duplicate_candidate_code when there is meaningful evidence of overlap; otherwise null.",
        "Do not include any prose or markdown fences in the response."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        "Analyze the incident snapshot below and return the JSON object.",
        "",
        JSON.stringify(sourceSnapshot, null, 2)
      ].join("\n")
    }
  ];
}

async function callChatCompletionsWithRetry(messages) {
  const requestOptions = {
    model: env.openaiModel,
    messages,
    temperature: 0.2,
    max_tokens: 1400
  };

  if (!usingCustomBaseUrl) {
    requestOptions.response_format = {
      type: "json_schema",
      json_schema: analysisJsonSchema
    };
  } else {
    requestOptions.response_format = { type: "json_object" };
  }

  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await openAIClient.chat.completions.create(requestOptions);
      const content = response.choices?.[0]?.message?.content ?? "";
      const jsonText = extractJsonObject(content);
      const parsed = JSON.parse(jsonText);
      return { parsed, response };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("AI provider returned no usable response");
}

async function buildLiveAnalysis(incident, attachments, candidateIncidents) {
  const sourceSnapshot = buildSourceSnapshot(incident, attachments, candidateIncidents);
  const messages = buildPromptMessages(sourceSnapshot);
  const { parsed: rawParsed, response } = await callChatCompletionsWithRetry(messages);

  const parsed = analysisSchema.parse(rawParsed);
  const matchedDuplicate = parsed.duplicate_candidate_code
    ? candidateIncidents.find((candidate) => candidate.incident_code === parsed.duplicate_candidate_code)
    : null;

  return {
    provider: activeProvider,
    model: env.openaiModel,
    status: "COMPLETED",
    title_suggestion: parsed.title_suggestion,
    summary_suggestion: parsed.summary_suggestion,
    category_suggestion: parsed.category_suggestion,
    priority_suggestion: parsed.priority_suggestion,
    department_suggestion: parsed.department_suggestion,
    tags_suggestion: parsed.tags_suggestion,
    suggested_action_suggestion: parsed.suggested_action_suggestion,
    duplicate_candidate_id: matchedDuplicate?.id ?? null,
    duplicate_candidate_code: matchedDuplicate?.incident_code ?? null,
    duplicate_candidate_title: matchedDuplicate?.title ?? null,
    duplicate_confidence: parsed.duplicate_candidate_code ? parsed.duplicate_confidence : 0,
    confidence_score: parsed.confidence_score,
    rationale: parsed.rationale,
    prompt_version: aiPromptVersion,
    source_snapshot: sourceSnapshot,
    raw_response: {
      id: response.id,
      model: env.openaiModel,
      base_url: env.openaiBaseUrl || "default",
      usage: response.usage ?? null
    },
    error_message: null
  };
}

function deriveTitleFromText(text) {
  const trimmed = String(text ?? "").trim();

  if (!trimmed) {
    return "Untitled incident from automated intake";
  }

  const firstLine = trimmed.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length >= 8);
  const candidate = firstLine ?? trimmed.split(/[.!?]/).find((segment) => segment.trim().length >= 8) ?? trimmed;
  const shaped = candidate.replace(/\s+/g, " ").trim();

  if (shaped.length <= 120) {
    return shaped.length >= 5 ? shaped : `${shaped} (automated intake)`;
  }

  return `${shaped.slice(0, 117).trim()}...`;
}

function deriveSummaryFromText(text) {
  const cleaned = String(text ?? "").replace(/\s+/g, " ").trim();

  if (cleaned.length >= 20) {
    return summarizeText(cleaned, 2400);
  }

  return "Automated intake captured an incident report but extracted body was shorter than expected. Manual review is recommended.";
}

async function generateSimpleCompletion(prompt) {
  if (!openAIClient) {
    return null;
  }

  try {
    const response = await openAIClient.chat.completions.create({
      model: env.openaiModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 320
    });
    const content = response.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}

function buildHeuristicJobSummary(job) {
  const process = job.process_name || "robot run";
  const status = String(job.status || "").toLowerCase().replace(/_/g, " ");
  const channelText = job.source_channel
    ? ` triggered via ${String(job.source_channel).toLowerCase().replace(/_/g, " ")}`
    : "";

  const opener = (() => {
    switch (job.status) {
      case "COMPLETED":
      case "INCIDENT_CREATED":
        return `The ${process}${channelText} completed successfully.`;
      case "FAILED":
        return `The ${process}${channelText} did not finish and needs operator attention.`;
      case "REVIEW_REQUIRED":
        return `The ${process}${channelText} paused for manual review before it can continue.`;
      case "RETRYING":
        return `The ${process}${channelText} is retrying after a transient issue.`;
      default:
        return `The ${process}${channelText} is currently ${status || "in progress"}.`;
    }
  })();

  const detail = job.failure_reason
    ? ` The robot reported: ${job.failure_reason}`
    : job.summary_report
      ? ` ${job.summary_report}`
      : "";

  const next = (() => {
    if (job.status === "FAILED") return " Operations should review the failure and decide whether to retry or escalate.";
    if (job.status === "REVIEW_REQUIRED") return " A reviewer should confirm the next action before reprocessing.";
    if (job.status === "RETRYING") return " No action is required while the retry is in progress.";
    if (job.related_incident_id) return " A linked incident has been created for follow-up.";
    return "";
  })();

  return `${opener}${detail}${next}`.replace(/\s+/g, " ").trim();
}

const jobSummaryCache = new Map();
const JOB_SUMMARY_TTL_MS = 10 * 60 * 1000;

function buildJobCacheKey(job) {
  return `${job.job_reference}|${job.status}|${job.retry_attempts ?? 0}|${job.last_callback_at?.toISOString?.() ?? job.last_callback_at ?? ""}`;
}

export const aiService = {
  async generateJobSummary(job) {
    const cacheKey = buildJobCacheKey(job);
    const cached = jobSummaryCache.get(cacheKey);

    if (cached && Date.now() - cached.at < JOB_SUMMARY_TTL_MS) {
      return cached.summary;
    }

    const heuristic = buildHeuristicJobSummary(job);
    const logs = job.automation_logs ?? [];
    const context = {
      process_name: job.process_name,
      status: job.status,
      source_channel: job.source_channel,
      failure_reason: job.failure_reason,
      summary_report: job.summary_report,
      retry_attempts: job.retry_attempts,
      events: logs.map((log) => ({ event: log.event_type, result: log.result, error: log.error_message })).slice(0, 5)
    };

    const prompt = [
      "You are a helpful assistant for DHL operations.",
      "Summarise the following UiPath robot run for a non-technical reader in two short sentences.",
      "Focus on the outcome, what went wrong if anything, and the recommended next step.",
      "Do not mention internal IDs, payload keys, or references like job_reference, mailbox paths, or attachment ids.",
      "Plain prose only, no markdown, no bullet points.",
      "Robot run context:",
      "",
      JSON.stringify(context, null, 2)
    ].join("\n");

    const aiSummary = openAIClient ? await generateSimpleCompletion(prompt) : null;
    const summary = aiSummary || heuristic;
    jobSummaryCache.set(cacheKey, { summary, at: Date.now() });
    return summary;
  },

  buildSeedFromText(rawText, context = {}) {
    const text = String(rawText ?? "").trim();
    const baseIncident = {
      title: context.title ?? deriveTitleFromText(text),
      summary: context.summary ?? deriveSummaryFromText(text),
      tags: context.tags ?? []
    };

    const detectionText = `${baseIncident.title} ${baseIncident.summary} ${baseIncident.tags.join(" ")}`;
    const category = detectCategoryFromKeywords(detectionText, { source_type: context.source_type ?? "RPA" });
    const priority = detectPriority(detectionText, { ...baseIncident, category });
    const department = categoryToDepartment[category] ?? "Customer Support";
    const tags = detectTags(detectionText, { ...baseIncident, category });

    return {
      title: baseIncident.title,
      summary: baseIncident.summary,
      category,
      priority,
      assigned_department: department,
      tags,
      suggested_action: suggestAction(category, department)
    };
  },

  getRuntimeStatus() {
    return {
      configured: Boolean(env.openaiApiKey),
      provider: activeProvider,
      provider_label: aiProviderLabels[activeProvider] ?? aiProviderLabels.OPENAI_COMPATIBLE,
      model: env.openaiApiKey ? env.openaiModel : null,
      base_url: env.openaiApiKey ? env.openaiBaseUrl || "https://api.openai.com/v1" : null,
      mode: env.openaiApiKey ? "live" : "fallback"
    };
  },

  async analyzeIncident(incident, attachments, recentIncidents) {
    const candidateIncidents = recentIncidents
      .filter((candidate) => candidate.id !== incident.id)
      .slice(0, duplicateWindowDays);

    if (!env.openaiApiKey) {
      return buildHeuristicAnalysis(incident, attachments, candidateIncidents);
    }

    try {
      return await buildLiveAnalysis(incident, attachments, candidateIncidents);
    } catch (error) {
      const fallback = buildHeuristicAnalysis(incident, attachments, candidateIncidents);
      fallback.error_message = `Live AI provider failed, used heuristic fallback: ${error.message}`;
      return fallback;
    }
  },

  buildPatchFromAnalysis(analysis, fields) {
    const requestedFields = [...new Set(fields)].filter((field) => aiApplicableFields.includes(field));

    const patch = {};
    const appliedFields = [];

    for (const field of requestedFields) {
      if (field === "assigned_department" && analysis.department_suggestion) {
        patch.assigned_department = analysis.department_suggestion;
        appliedFields.push(field);
        continue;
      }

      if (field === "suggested_action" && analysis.suggested_action_suggestion) {
        patch.suggested_action = analysis.suggested_action_suggestion;
        appliedFields.push(field);
        continue;
      }

      if (field === "tags" && analysis.tags_suggestion?.length) {
        patch.tags = analysis.tags_suggestion;
        appliedFields.push(field);
        continue;
      }

      const suggestionKey = `${field}_suggestion`;
      if (analysis[suggestionKey]) {
        patch[field] = analysis[suggestionKey];
        appliedFields.push(field);
      }
    }

    return { patch, appliedFields };
  }
};
