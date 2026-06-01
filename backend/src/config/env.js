import dotenv from "dotenv";

dotenv.config();

export const env = {
  databaseUrl:
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/dhl_incident_platform?schema=public",
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "change-me-before-production",
  uipathSharedSecret: process.env.UIPATH_SHARED_SECRET ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "",
  defaultDemoPassword: process.env.DEFAULT_DEMO_PASSWORD ?? "Passw0rd!",
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL ?? "admin.ops@dhl.local",
  defaultAdminName: process.env.DEFAULT_ADMIN_NAME ?? "Operations Admin",
  bootstrapOnStart: String(process.env.BOOTSTRAP_ON_START ?? "true").toLowerCase() === "true"
};
