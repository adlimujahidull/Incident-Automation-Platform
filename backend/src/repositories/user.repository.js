import { prisma } from "../lib/prisma.js";

export const userRepository = {
  async list() {
    return prisma.user.findMany({
      orderBy: {
        created_at: "asc"
      }
    });
  },

  async findByEmail(email) {
    return prisma.user.findUnique({
      where: {
        email: String(email).toLowerCase()
      }
    });
  },

  async findById(id) {
    return prisma.user.findUnique({
      where: { id }
    });
  },

  async create(record) {
    return prisma.user.create({
      data: record
    });
  },

  async upsertByEmail(email, record) {
    return prisma.user.upsert({
      where: {
        email: String(email).toLowerCase()
      },
      update: record,
      create: {
        ...record,
        email: String(email).toLowerCase()
      }
    });
  }
};
