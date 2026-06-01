import prismaPackage from "@prisma/client";

const { PrismaClient } = prismaPackage;

const prismaGlobal = globalThis;

export const prisma =
  prismaGlobal.__dhlPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.__dhlPrisma = prisma;
}
