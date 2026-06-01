import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { bootstrapService } from "./services/bootstrap.service.js";

async function startServer() {
  const app = createApp();

  if (env.bootstrapOnStart) {
    await bootstrapService.ensureDevelopmentDataset();
  }

  app.listen(env.port, () => {
    logger.info(`Backend listening on http://localhost:${env.port}`);
  });
}

startServer().catch((error) => {
  logger.error("Failed to start backend", {
    message: error.message
  });
  process.exit(1);
});
