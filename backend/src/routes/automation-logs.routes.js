import { Router } from "express";

import { permissions } from "../constants/authorization.constants.js";
import { automationLogController } from "../controllers/automation-log.controller.js";
import { authorizePermission } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middleware/validate.js";
import {
  createAutomationLogSchema,
  listAutomationLogsQuerySchema
} from "../validators/automation-log.validator.js";

export const automationLogsRouter = Router();

automationLogsRouter.get(
  "/",
  authorizePermission(permissions.view_automation_logs),
  validate(listAutomationLogsQuerySchema, "query"),
  asyncHandler(automationLogController.list)
);
automationLogsRouter.get(
  "/:id",
  authorizePermission(permissions.view_automation_logs),
  asyncHandler(automationLogController.getById)
);
automationLogsRouter.post(
  "/",
  authorizePermission(permissions.create_automation_logs),
  validate(createAutomationLogSchema),
  asyncHandler(automationLogController.create)
);
