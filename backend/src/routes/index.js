import { Router } from "express";

import { automationLogsRouter } from "./automation-logs.routes.js";
import { authRouter } from "./auth.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";
import { incidentsRouter } from "./incidents.routes.js";
import { metaRouter } from "./meta.routes.js";
import { uipathRouter } from "./uipath.routes.js";
import { uploadsRouter } from "./uploads.routes.js";
import { usersRouter } from "./users.routes.js";
import { authenticate } from "../middleware/authenticate.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/meta", authenticate, metaRouter);
apiRouter.use("/dashboard", authenticate, dashboardRouter);
apiRouter.use("/incidents", authenticate, incidentsRouter);
apiRouter.use("/uploads", authenticate, uploadsRouter);
apiRouter.use("/automation/logs", authenticate, automationLogsRouter);
apiRouter.use("/uipath", uipathRouter);
apiRouter.use("/users", authenticate, usersRouter);
