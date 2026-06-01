import jwt from "jsonwebtoken";

import { getRolePermissions, hasPermission } from "../constants/authorization.constants.js";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/user.repository.js";
import { HttpError } from "../utils/http-error.js";

export function authenticate(request, _response, next) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Authentication token is required"));
  }

  const token = authorization.replace("Bearer ", "");

  Promise.resolve()
    .then(async () => {
      const payload = jwt.verify(token, env.jwtSecret);
      const userId = payload.id ?? payload.sub;
      const user = await userRepository.findById(userId);

      if (!user) {
        throw new HttpError(401, "Authenticated user no longer exists");
      }

      const { password_hash, ...safeUser } = user;
      request.user = {
        ...safeUser,
        permissions: getRolePermissions(user.role)
      };
    })
    .then(() => next())
    .catch((error) => {
      if (error instanceof HttpError) {
        next(error);
        return;
      }

      next(new HttpError(401, "Authentication token is invalid"));
    });
}

export function authorizePermission(permission) {
  return function authorizePermissionHandler(request, _response, next) {
    if (!request.user || !hasPermission(request.user.role, permission)) {
      return next(new HttpError(403, "You are not allowed to perform this action"));
    }

    next();
  };
}
