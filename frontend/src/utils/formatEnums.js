const STATUS_LABELS = {
  NEW: "New",
  PROCESSING: "Processing",
  OPEN: "Open",
  ASSIGNED: "Assigned",
  "IN REVIEW": "In Review",
  IN_REVIEW: "In Review",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  DUPLICATE: "Duplicate",
  FAILED: "Failed"
};

const PRIORITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical"
};

const SOURCE_TYPE_LABELS = {
  MANUAL_UPLOAD: "Manual Upload",
  EMAIL: "Email Intake",
  CHAT: "Chat Capture",
  RPA: "Robot Intake",
  API: "API Submission"
};

const SOURCE_CHANNEL_LABELS = {
  EMAIL_QUEUE: "Email Queue",
  FOLDER_WATCHER: "Folder Watcher",
  OCR_QUEUE: "OCR Queue",
  API_BRIDGE: "API Bridge"
};

const JOB_STATUS_LABELS = {
  RECEIVED: "Received",
  PROCESSING: "Processing",
  INCIDENT_CREATED: "Incident Created",
  REVIEW_REQUIRED: "Review Required",
  RETRYING: "Retrying",
  FAILED: "Failed",
  COMPLETED: "Completed"
};

const AUTOMATION_RESULT_LABELS = {
  SUCCESS: "Success",
  FAILED: "Failed",
  RETRYING: "Retrying"
};

const SOURCE_SYSTEM_LABELS = {
  UIPATH: "UiPath Robot",
  INTERNAL: "Internal System"
};

const EVENT_TYPE_LABELS = {
  INTAKE_RECEIVED: "Intake received",
  INTAKE_PROCESSING: "Intake processing",
  STATUS_CALLBACK: "Status callback",
  INCIDENT_CREATED: "Incident created",
  INCIDENT_CREATION_FAILED: "Incident creation failed",
  ATTACHMENT_LINKED: "Evidence linked",
  AI_ANALYSIS_RUN: "AI analysis run",
  AI_AUTO_TRIAGE_FAILED: "AI triage failed",
  WORKFLOW_TRANSITION: "Workflow transition",
  JOB_RECEIVED: "Robot run received",
  JOB_PROCESSING: "Robot run in progress",
  JOB_COMPLETED: "Robot run completed",
  JOB_FAILED: "Robot run failed",
  JOB_INCIDENT_CREATED: "Incident created by robot",
  JOB_REVIEW_REQUIRED: "Review required",
  JOB_RETRYING: "Robot run retrying",
  JOB_RECEIVED_INTAKE: "Intake received",
  CALLBACK_REVIEW_REQUIRED: "Review required",
  CALLBACK_RECEIVED: "Callback received",
  RUN_SUMMARY_EMAIL: "Run summary email",
  DUPLICATE_SKIPPED: "Duplicate skipped (14-day window)"
};

const ACTION_LABELS = {
  INCIDENT_CREATED: "Incident created",
  INCIDENT_UPDATED: "Incident updated",
  INCIDENT_ASSIGNED: "Assigned",
  INCIDENT_REASSIGNED: "Reassigned",
  STATUS_CHANGED: "Status changed",
  INCIDENT_RESOLVED: "Resolved",
  INCIDENT_REJECTED: "Rejected",
  INCIDENT_REOPENED: "Reopened",
  INCIDENT_FAILED: "Marked failed",
  INCIDENT_CLOSED: "Closed",
  MARKED_DUPLICATE: "Marked duplicate",
  FAILURE_RECOVERY_STARTED: "Failure recovery started",
  DUPLICATE_DETECTED: "Duplicate detected",
  COMMENT_ADDED: "Comment added",
  ATTACHMENT_LINKED: "Evidence linked",
  ATTACHMENTS_LINKED: "Evidence batch linked",
  AI_SUGGESTIONS_APPLIED: "AI suggestions applied",
  INCIDENT_ARCHIVED: "Incident archived (audit-safe delete)"
};

const PROVIDER_LABELS = {
  OPENAI: "OpenAI",
  NVIDIA_NIM: "NVIDIA NIM",
  DEEPSEEK: "DeepSeek",
  OPENAI_COMPATIBLE: "AI provider",
  HEURISTIC: "Built-in heuristics"
};

const FILE_TYPE_LABELS = {
  "application/pdf": "PDF",
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "image/jpg": "JPEG image",
  "text/plain": "Text file",
  "application/msword": "Word document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document"
};

function titleCase(value) {
  return String(value)
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function lookup(table, value) {
  if (value === null || value === undefined || value === "") return "";
  return table[value] ?? titleCase(value);
}

export function formatStatus(value) {
  return lookup(STATUS_LABELS, value);
}

export function formatPriority(value) {
  return lookup(PRIORITY_LABELS, value);
}

export function formatSourceType(value) {
  return lookup(SOURCE_TYPE_LABELS, value);
}

export function formatSourceChannel(value) {
  return lookup(SOURCE_CHANNEL_LABELS, value);
}

export function formatJobStatus(value) {
  return lookup(JOB_STATUS_LABELS, value);
}

export function formatAutomationResult(value) {
  return lookup(AUTOMATION_RESULT_LABELS, value);
}

export function formatSourceSystem(value) {
  return lookup(SOURCE_SYSTEM_LABELS, value);
}

export function formatEventType(value) {
  return lookup(EVENT_TYPE_LABELS, value);
}

export function formatAction(value) {
  return lookup(ACTION_LABELS, value);
}

export function formatProvider(value) {
  return lookup(PROVIDER_LABELS, value);
}

export function formatFileType(value) {
  if (!value) return "";
  const direct = FILE_TYPE_LABELS[value];
  if (direct) return direct;
  if (value.startsWith("image/")) return "Image";
  if (value.startsWith("application/")) return "Document";
  return titleCase(value.replace(/.*\//, ""));
}

export function formatCategory(value) {
  if (!value) return "";
  return STATUS_LABELS[value] || /[a-z]/.test(value) ? value : titleCase(value);
}

export function formatDepartment(value) {
  if (!value) return "";
  return /[a-z]/.test(value) ? value : titleCase(value);
}

const ACTOR_LABELS = {
  "admin.ops@dhl.local": "Operations Admin",
  "reviewer.ops@dhl.local": "Case Reviewer",
  "support.ops@dhl.local": "Support Coordinator",
  system: "System"
};

export function formatActor(value) {
  if (!value) return "System";

  const normalized = String(value).trim();
  if (!normalized) return "System";

  if (ACTOR_LABELS[normalized]) {
    return ACTOR_LABELS[normalized];
  }

  if (normalized.toLowerCase().startsWith("uipath:")) {
    return "UiPath Robot";
  }

  if (normalized.includes("@")) {
    const handle = normalized.split("@")[0];
    return titleCase(handle.replace(/\./g, " "));
  }

  return titleCase(normalized);
}

const INTERNAL_TAG_PREFIXES = ["ai-", "rpa-", "system-", "auto-", "bot-"];
const INTERNAL_TAG_VALUES = new Set([
  "ai-seeded",
  "rpa-intake",
  "system-generated",
  "auto-triage",
  "bot-created",
  "machine-generated"
]);

export function filterUserVisibleTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => {
    if (!tag) return false;
    const value = String(tag).trim().toLowerCase();
    if (!value) return false;
    if (INTERNAL_TAG_VALUES.has(value)) return false;
    return !INTERNAL_TAG_PREFIXES.some((prefix) => value.startsWith(prefix));
  });
}
