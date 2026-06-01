import { Router } from "express";

import { userController } from "../controllers/user.controller.js";
import { authorizePermission } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { permissions } from "../constants/authorization.constants.js";

export const usersRouter = Router();

usersRouter.get("/", authorizePermission(permissions.view_users), asyncHandler(userController.list));
