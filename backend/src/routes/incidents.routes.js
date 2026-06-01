import { Router } from "express";

import { permissions } from "../constants/authorization.constants.js";
import { incidentController } from "../controllers/incident.controller.js";
import { authorizePermission } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middleware/validate.js";
import {
  addIncidentCommentSchema,
  applyAiAnalysisSchema,
  archiveIncidentSchema,
  assignIncidentSchema,
  createIncidentSchema,
  listIncidentsQuerySchema,
  updateIncidentSchema,
  updateIncidentStatusSchema
} from "../validators/incident.validator.js";

export const incidentsRouter = Router();

incidentsRouter.get(
  "/assignees",
  authorizePermission(permissions.assign_incidents),
  asyncHandler(incidentController.listAssignees)
);
incidentsRouter.get(
  "/",
  authorizePermission(permissions.view_incidents),
  validate(listIncidentsQuerySchema, "query"),
  asyncHandler(incidentController.list)
);
incidentsRouter.get("/:id", authorizePermission(permissions.view_incidents), asyncHandler(incidentController.getById));
incidentsRouter.get(
  "/:id/history",
  authorizePermission(permissions.view_incidents),
  asyncHandler(incidentController.getHistory)
);
incidentsRouter.post(
  "/",
  authorizePermission(permissions.create_incidents),
  validate(createIncidentSchema),
  asyncHandler(incidentController.create)
);
incidentsRouter.put(
  "/:id",
  authorizePermission(permissions.edit_incidents),
  validate(updateIncidentSchema),
  asyncHandler(incidentController.update)
);
incidentsRouter.patch(
  "/:id/status",
  authorizePermission(permissions.transition_incidents),
  validate(updateIncidentStatusSchema),
  asyncHandler(incidentController.updateStatus)
);
incidentsRouter.patch(
  "/:id/assignment",
  authorizePermission(permissions.assign_incidents),
  validate(assignIncidentSchema),
  asyncHandler(incidentController.assign)
);
incidentsRouter.post(
  "/:id/comments",
  authorizePermission(permissions.comment_incidents),
  validate(addIncidentCommentSchema),
  asyncHandler(incidentController.addComment)
);
incidentsRouter.post(
  "/:id/ai-analyses",
  authorizePermission(permissions.run_ai_analysis),
  asyncHandler(incidentController.runAiAnalysis)
);
incidentsRouter.post(
  "/:id/ai-analyses/:analysisId/apply",
  authorizePermission(permissions.apply_ai_suggestions),
  validate(applyAiAnalysisSchema),
  asyncHandler(incidentController.applyAiAnalysis)
);
incidentsRouter.delete(
  "/:id",
  authorizePermission(permissions.delete_incidents),
  validate(archiveIncidentSchema),
  asyncHandler(incidentController.archive)
);
