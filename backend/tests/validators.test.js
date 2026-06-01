import { describe, expect, it } from "vitest";

import { loginSchema } from "../src/validators/auth.validator.js";
import {
  addIncidentCommentSchema,
  assignIncidentSchema,
  createIncidentSchema,
  listIncidentsQuerySchema,
  updateIncidentStatusSchema
} from "../src/validators/incident.validator.js";
import {
  createAutomationLogSchema,
  listAutomationLogsQuerySchema
} from "../src/validators/automation-log.validator.js";

describe("auth validator", () => {
  it("accepts a well-formed credentials payload", () => {
    const result = loginSchema.safeParse({
      email: "admin.ops@dhl.local",
      password: "Passw0rd!"
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid email formats", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "Passw0rd!" });
    expect(result.success).toBe(false);
  });

  it("rejects passwords below the minimum length", () => {
    const result = loginSchema.safeParse({ email: "admin.ops@dhl.local", password: "short" });
    expect(result.success).toBe(false);
  });
});

describe("incident list query validator", () => {
  it("coerces CSV status into an array and defaults pagination", () => {
    const result = listIncidentsQuerySchema.safeParse({
      status: "OPEN,ASSIGNED",
      priority: ["High", "Critical"]
    });

    expect(result.success).toBe(true);
    expect(result.data.status).toEqual(["OPEN", "ASSIGNED"]);
    expect(result.data.priority).toEqual(["High", "Critical"]);
    expect(result.data.page).toBe(1);
    expect(result.data.pageSize).toBe(25);
  });

  it("rejects unknown status values", () => {
    const result = listIncidentsQuerySchema.safeParse({ status: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects bucket values that are not in the allowed set", () => {
    const result = listIncidentsQuerySchema.safeParse({ bucket: "made-up" });
    expect(result.success).toBe(false);
  });

  it("caps pageSize at 100", () => {
    const result = listIncidentsQuerySchema.safeParse({ pageSize: 250 });
    expect(result.success).toBe(false);
  });
});

describe("incident create validator", () => {
  const baseIncident = {
    title: "Damaged parcel reported from sortation line",
    summary:
      "Warehouse note and customer images show a crushed parcel after morning sortation. Escalation requested for review.",
    category: "Damaged Parcel",
    priority: "High",
    source_type: "MANUAL_UPLOAD",
    assigned_department: "Warehouse"
  };

  it("accepts a complete incident payload", () => {
    const result = createIncidentSchema.safeParse({ ...baseIncident, tags: ["damage", "claim"] });
    expect(result.success).toBe(true);
  });

  it("rejects payloads with unknown categories", () => {
    const result = createIncidentSchema.safeParse({ ...baseIncident, category: "Unknown" });
    expect(result.success).toBe(false);
  });

  it("rejects payloads with summaries that are too short", () => {
    const result = createIncidentSchema.safeParse({ ...baseIncident, summary: "too short" });
    expect(result.success).toBe(false);
  });
});

describe("incident status + assignment + comment validators", () => {
  it("requires comment on DUPLICATE without target only when status is DUPLICATE", () => {
    const fine = updateIncidentStatusSchema.safeParse({ status: "OPEN" });
    expect(fine.success).toBe(true);

    const dupWithCode = updateIncidentStatusSchema.safeParse({
      status: "DUPLICATE",
      duplicate_of_incident_code: "INC-SEED-0001"
    });
    expect(dupWithCode.success).toBe(true);
  });

  it("requires a user id for assignment", () => {
    expect(assignIncidentSchema.safeParse({ assigned_to_user_id: "" }).success).toBe(false);
    expect(assignIncidentSchema.safeParse({ assigned_to_user_id: "user_123" }).success).toBe(true);
  });

  it("enforces a minimum body length for comments", () => {
    expect(addIncidentCommentSchema.safeParse({ body: "ok" }).success).toBe(false);
    expect(addIncidentCommentSchema.safeParse({ body: "Triage complete." }).success).toBe(true);
  });
});

describe("automation log validators", () => {
  it("accepts payload snapshots and related incident references on create", () => {
    const result = createAutomationLogSchema.safeParse({
      process_name: "UiPath Inbox Intake",
      result: "SUCCESS",
      retry_attempts: 1,
      payload_snapshot: { source: "email", subject: "Damage report" },
      related_incident_id: "incident_abc"
    });
    expect(result.success).toBe(true);
  });

  it("coerces CSV result filters into arrays on list", () => {
    const result = listAutomationLogsQuerySchema.safeParse({ result: "SUCCESS,FAILED" });
    expect(result.success).toBe(true);
    expect(result.data.result).toEqual(["SUCCESS", "FAILED"]);
  });

  it("rejects unknown result enum values", () => {
    const result = listAutomationLogsQuerySchema.safeParse({ result: "MAYBE" });
    expect(result.success).toBe(false);
  });
});
