import { describe, expect, it } from "vitest";

import {
  incidentStatuses,
  workflowTransitions
} from "../src/constants/incident.constants.js";

describe("workflow transitions", () => {
  it("defines an entry for every operational status", () => {
    for (const status of incidentStatuses) {
      expect(workflowTransitions).toHaveProperty(status);
    }
  });

  it("only allows transitions to known statuses", () => {
    for (const [origin, allowed] of Object.entries(workflowTransitions)) {
      for (const target of allowed) {
        expect(incidentStatuses).toContain(target);
        expect(target).not.toBe(origin);
      }
    }
  });

  it("treats CLOSED, REJECTED, and DUPLICATE as terminal", () => {
    expect(workflowTransitions.CLOSED).toEqual([]);
    expect(workflowTransitions.REJECTED).toEqual([]);
    expect(workflowTransitions.DUPLICATE).toEqual([]);
  });

  it("supports failure recovery from FAILED into PROCESSING or OPEN", () => {
    expect(workflowTransitions.FAILED).toContain("PROCESSING");
    expect(workflowTransitions.FAILED).toContain("OPEN");
  });

  it("supports reopening from RESOLVED back to OPEN", () => {
    expect(workflowTransitions.RESOLVED).toContain("OPEN");
  });
});
