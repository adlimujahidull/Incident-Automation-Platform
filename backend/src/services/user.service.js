import bcrypt from "bcryptjs";

import { getRolePermissions } from "../constants/authorization.constants.js";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/user.repository.js";

let bootstrapComplete = false;

async function ensureBootstrapUsers() {
  if (bootstrapComplete) {
    return;
  }

  const defaults = [
    {
      name: env.defaultAdminName,
      email: env.defaultAdminEmail,
      role: "ADMIN",
      department: "Command Center"
    },
    {
      name: "Case Reviewer",
      email: "reviewer.ops@dhl.local",
      role: "REVIEWER",
      department: "Customer Support"
    },
    {
      name: "Support Coordinator",
      email: "support.ops@dhl.local",
      role: "SUPPORT_STAFF",
      department: "Delivery Operations"
    }
  ];

  const password_hash = await bcrypt.hash(env.defaultDemoPassword, 10);

  await Promise.all(
    defaults.map((user) =>
      userRepository.upsertByEmail(user.email, {
        ...user,
        password_hash
      })
    )
  );

  bootstrapComplete = true;
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { password_hash, ...safeUser } = user;
  return {
    ...safeUser,
    permissions: getRolePermissions(safeUser.role)
  };
}

export const userService = {
  async ensureBootstrapUsers() {
    await ensureBootstrapUsers();
  },

  async listUsers() {
    await ensureBootstrapUsers();
    const users = await userRepository.list();
    return users.map(sanitizeUser);
  },

  async listAssignableUsers() {
    const users = await this.listUsers();
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department
    }));
  },

  async findUserByEmail(email) {
    await ensureBootstrapUsers();
    return userRepository.findByEmail(email);
  },

  async findUserById(id) {
    await ensureBootstrapUsers();
    const user = await userRepository.findById(id);
    return sanitizeUser(user);
  }
};
