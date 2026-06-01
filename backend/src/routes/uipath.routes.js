import { Router } from "express";

import { permissions } from "../constants/authorization.constants.js";
import { uipathController } from "../controllers/uipath.controller.js";
import { uploadController } from "../controllers/upload.controller.js";
import { authenticate, authorizePermission } from "../middleware/authenticate.js";
import { authenticateUiPath } from "../middleware/authenticate-uipath.js";
import { validate } from "../middleware/validate.js";
import { upload } from "../middleware/upload.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createUiPathIntakeSchema,
  duplicateCheckSchema,
  listUiPathJobsQuerySchema,
  recordRunSummarySchema,
  updateUiPathJobStatusSchema
} from "../validators/uipath.validator.js";

export const uipathRouter = Router();

uipathRouter.get(
  "/manifest",
  authenticate,
  authorizePermission(permissions.view_settings),
  asyncHandler(uipathController.manifest)
);
uipathRouter.get(
  "/jobs",
  authenticate,
  authorizePermission(permissions.view_automation_logs),
  validate(listUiPathJobsQuerySchema, "query"),
  asyncHandler(uipathController.listJobs)
);
uipathRouter.get(
  "/jobs/:jobReference",
  authenticate,
  authorizePermission(permissions.view_automation_logs),
  asyncHandler(uipathController.getJob)
);
uipathRouter.post(
  "/jobs/intake",
  authenticateUiPath,
  validate(createUiPathIntakeSchema),
  asyncHandler(uipathController.intake)
);
uipathRouter.patch(
  "/jobs/:jobReference/status",
  authenticateUiPath,
  validate(updateUiPathJobStatusSchema),
  asyncHandler(uipathController.updateStatus)
);

uipathRouter.post(
  "/jobs/:jobReference/summarize",
  authenticate,
  authorizePermission(permissions.view_automation_logs),
  asyncHandler(uipathController.summarizeJob)
);

uipathRouter.post(
  "/duplicate-check",
  authenticateUiPath,
  validate(duplicateCheckSchema),
  asyncHandler(uipathController.duplicateCheck)
);

uipathRouter.post(
  "/runs/summary",
  authenticateUiPath,
  validate(recordRunSummarySchema),
  asyncHandler(uipathController.recordRunSummary)
);

uipathRouter.post(
  "/uploads",
  authenticateUiPath,
  upload.single("file"),
  asyncHandler(uploadController.machineUpload)
);

uipathRouter.post(
  "/uploads/:id/extract",
  authenticateUiPath,
  asyncHandler(uploadController.machineExtract)
);
