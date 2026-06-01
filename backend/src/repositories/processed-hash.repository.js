import { prisma } from "../lib/prisma.js";

const DEFAULT_WINDOW_DAYS = 14;

function cutoffFromDays(days = DEFAULT_WINDOW_DAYS) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export const processedHashRepository = {
  async findRecentByHash(hash, windowDays = DEFAULT_WINDOW_DAYS) {
    return prisma.processedHash.findFirst({
      where: {
        content_hash: hash,
        processed_at: { gte: cutoffFromDays(windowDays) }
      },
      orderBy: { processed_at: "desc" }
    });
  },

  async record(entry) {
    return prisma.processedHash.create({ data: entry });
  }
};
