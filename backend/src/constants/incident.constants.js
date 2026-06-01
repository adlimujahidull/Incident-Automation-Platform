export const incidentCategories = [
  "Late Delivery",
  "Damaged Parcel",
  "Address Issue",
  "Customer Complaint",
  "Warehouse Delay",
  "Tracking Failure",
  "System Error"
];

export const incidentPriorities = ["Low", "Medium", "High", "Critical"];

export const incidentDepartments = [
  "Logistics",
  "Customer Support",
  "Warehouse",
  "Technical Support",
  "Delivery Operations"
];

export const incidentStatuses = [
  "NEW",
  "PROCESSING",
  "OPEN",
  "ASSIGNED",
  "IN REVIEW",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
  "DUPLICATE",
  "FAILED"
];

export const sourceTypes = ["MANUAL_UPLOAD", "EMAIL", "CHAT", "RPA", "API"];

export const attachmentIngestionStatuses = ["STAGED", "LINKED"];

export const userRoles = ["ADMIN", "REVIEWER", "SUPPORT_STAFF"];

export const automationResults = ["SUCCESS", "FAILED", "RETRYING"];

export const automationSourceSystems = ["INTERNAL", "UIPATH"];

export const uipathSourceChannels = ["EMAIL_QUEUE", "FOLDER_WATCHER", "OCR_QUEUE", "API_BRIDGE"];

export const uipathJobStatuses = [
  "RECEIVED",
  "PROCESSING",
  "INCIDENT_CREATED",
  "REVIEW_REQUIRED",
  "RETRYING",
  "FAILED",
  "COMPLETED"
];

export const duplicateWindowDays = 14;

export const workflowTransitions = {
  NEW: ["PROCESSING", "OPEN", "FAILED", "DUPLICATE", "REJECTED"],
  PROCESSING: ["OPEN", "FAILED", "DUPLICATE", "REJECTED"],
  OPEN: ["ASSIGNED", "IN REVIEW", "RESOLVED", "REJECTED", "DUPLICATE"],
  ASSIGNED: ["IN REVIEW", "RESOLVED", "FAILED", "DUPLICATE"],
  "IN REVIEW": ["RESOLVED", "OPEN", "REJECTED", "DUPLICATE"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: [],
  REJECTED: [],
  DUPLICATE: [],
  FAILED: ["PROCESSING", "OPEN", "REJECTED"]
};
