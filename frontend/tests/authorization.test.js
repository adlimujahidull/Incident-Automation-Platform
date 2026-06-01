import { describe, expect, it } from "vitest";

import { hasPermission } from "@/utils/authorization";

describe("hasPermission", () => {
  it("returns true when the user permissions list contains the requested permission", () => {
    const user = { permissions: ["view_dashboard", "view_incidents"] };
    expect(hasPermission(user, "view_incidents")).toBe(true);
  });

  it("returns false when the requested permission is missing", () => {
    const user = { permissions: ["view_dashboard"] };
    expect(hasPermission(user, "view_users")).toBe(false);
  });

  it("returns false for users without a permissions array", () => {
    expect(hasPermission(null, "view_dashboard")).toBe(false);
    expect(hasPermission({}, "view_dashboard")).toBe(false);
    expect(hasPermission({ permissions: null }, "view_dashboard")).toBe(false);
  });
});
