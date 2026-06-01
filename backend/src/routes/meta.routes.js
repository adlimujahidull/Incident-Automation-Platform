import { Router } from "express";

import { permissions } from "../constants/authorization.constants.js";
import { metaController } from "../controllers/meta.controller.js";
import { authorizePermission } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/async-handler.js";

export const metaRouter = Router();

metaRouter.get(
  "/incident-options",
  authorizePermission(permissions.view_meta),
  asyncHandler(metaController.getIncidentOptions)
);
