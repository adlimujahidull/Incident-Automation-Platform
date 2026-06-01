import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { userService } from "./user.service.js";
import { HttpError } from "../utils/http-error.js";

export const authService = {
  async login(credentials) {
    const user = await userService.findUserByEmail(credentials.email);

    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const isValid = await bcrypt.compare(credentials.password, user.password_hash);

    if (!isValid) {
      throw new HttpError(401, "Invalid email or password");
    }

    const safeUser = await userService.findUserById(user.id);
    const token = jwt.sign({ id: user.id }, env.jwtSecret, {
      expiresIn: "8h"
    });

    return {
      token,
      user: safeUser
    };
  },

  async getCurrentUser(payload) {
    const user = await userService.findUserById(payload.id ?? payload.sub);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    return user;
  }
};
