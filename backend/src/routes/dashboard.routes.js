import { Router } from "express";

import { permissions } from "../constants/authorization.constants.js";
import { dashboardController } from "../controllers/dashboard.controller.js";
import { authorizePermission } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/async-handler.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/summary",
  authorizePermission(permissions.view_dashboard),
  asyncHandler(dashboardController.getSummary)
);
