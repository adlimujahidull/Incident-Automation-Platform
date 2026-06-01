import { Router } from "express";

import { permissions } from "../constants/authorization.constants.js";
import { uploadController } from "../controllers/upload.controller.js";
import { authorizePermission } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { upload } from "../middleware/upload.js";
import { listUploadsQuerySchema } from "../validators/upload.validator.js";

export const uploadsRouter = Router();

uploadsRouter.get(
  "/",
  authorizePermission(permissions.upload_attachments),
  validate(listUploadsQuerySchema, "query"),
  asyncHandler(uploadController.list)
);
uploadsRouter.post(
  "/",
  authorizePermission(permissions.upload_attachments),
  upload.single("file"),
  asyncHandler(uploadController.upload)
);
uploadsRouter.get(
  "/:id/download",
  authorizePermission(permissions.upload_attachments),
  asyncHandler(uploadController.download)
);
uploadsRouter.post(
  "/:id/extract",
  authorizePermission(permissions.upload_attachments),
  asyncHandler(uploadController.extract)
);
