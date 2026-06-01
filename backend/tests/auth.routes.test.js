import bcrypt from "bcryptjs";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(async (args) => ({
        id: `user_${args.create?.email ?? "bootstrap"}`,
        ...(args.create ?? args.update)
      }))
    }
  }
}));

const { prisma } = await import("../src/lib/prisma.js");
const { createApp } = await import("../src/app.js");
const supertest = (await import("supertest")).default;

const app = createApp();
const request = supertest(app);

const passwordHash = bcrypt.hashSync("Passw0rd!", 4);

const seededUser = {
  id: "user_admin_1",
  name: "Operations Admin",
  email: "admin.ops@dhl.local",
  password_hash: passwordHash,
  role: "ADMIN",
  department: "Command Center",
  created_at: new Date("2026-05-01T00:00:00Z"),
  updated_at: new Date("2026-05-01T00:00:00Z")
};

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockReset();
  });

  it("rejects invalid payload shapes with 400", async () => {
    const response = await request.post("/api/auth/login").send({ email: "not-an-email", password: "x" });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed");
    expect(Array.isArray(response.body.details)).toBe(true);
  });

  it("returns 401 when the user does not exist", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const response = await request
      .post("/api/auth/login")
      .send({ email: "missing.ops@dhl.local", password: "Passw0rd!" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");
  });

  it("returns 401 when the password does not match", async () => {
    prisma.user.findUnique.mockResolvedValue(seededUser);

    const response = await request
      .post("/api/auth/login")
      .send({ email: seededUser.email, password: "WrongPass1!" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");
  });

  it("issues a token and a safe user payload on success", async () => {
    prisma.user.findUnique.mockResolvedValue(seededUser);

    const response = await request
      .post("/api/auth/login")
      .send({ email: seededUser.email, password: "Passw0rd!" });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTypeOf("string");
    expect(response.body.user.email).toBe(seededUser.email);
    expect(response.body.user).not.toHaveProperty("password_hash");
    expect(response.body.user.permissions).toContain("view_dashboard");
  });
});

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockReset();
  });

  it("rejects requests without a bearer token", async () => {
    const response = await request.get("/api/auth/me");
    expect(response.status).toBe(401);
  });

  it("rejects requests with malformed bearer tokens", async () => {
    const response = await request.get("/api/auth/me").set("Authorization", "Bearer not-a-jwt");
    expect(response.status).toBe(401);
  });

  it("returns the current user after a successful login", async () => {
    prisma.user.findUnique.mockResolvedValue(seededUser);

    const loginResponse = await request
      .post("/api/auth/login")
      .send({ email: seededUser.email, password: "Passw0rd!" });

    expect(loginResponse.status).toBe(200);
    const { token } = loginResponse.body;

    prisma.user.findUnique.mockResolvedValue(seededUser);

    const meResponse = await request.get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.email).toBe(seededUser.email);
    expect(meResponse.body.user.permissions).toContain("view_incidents");
  });
});
