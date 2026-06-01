import { prisma } from "../lib/prisma.js";

const automationLogInclude = {
  related_incident: {
    select: {
      id: true,
      incident_code: true,
      title: true,
      status: true,
      priority: true,
      assigned_department: true
    }
  }
};

function buildAutomationLogWhere(filters = {}) {
  const conditions = [];
  const normalizedQuery = String(filters.query ?? "").trim();

  if (normalizedQuery) {
    conditions.push({
      OR: [
        { process_name: { contains: normalizedQuery, mode: "insensitive" } },
        { error_message: { contains: normalizedQuery, mode: "insensitive" } },
        { job_reference: { contains: normalizedQuery, mode: "insensitive" } },
        { event_type: { contains: normalizedQuery, mode: "insensitive" } }
      ]
    });
  }

  if (filters.result?.length) {
    conditions.push({ result: { in: filters.result } });
  }

  if (filters.source_system?.length) {
    conditions.push({ source_system: { in: filters.source_system } });
  }

  if (filters.related_incident_id) {
    conditions.push({ related_incident_id: filters.related_incident_id });
  }

  if (filters.from || filters.to) {
    conditions.push({
      executed_at: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {})
      }
    });
  }

  return conditions.length ? { AND: conditions } : {};
}

export const automationLogRepository = {
  async list(options = {}) {
    if (options.take !== undefined && options.take !== null) {
      return prisma.automationLog.findMany({
        include: automationLogInclude,
        orderBy: { executed_at: "desc" },
        take: options.take
      });
    }

    const filters = options ?? {};
    const where = buildAutomationLogWhere(filters);
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    const [items, total] = await prisma.$transaction([
      prisma.automationLog.findMany({
        where,
        include: automationLogInclude,
        orderBy: { executed_at: "desc" },
        skip: offset,
        take: pageSize
      }),
      prisma.automationLog.count({ where })
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      hasMore: offset + items.length < total
    };
  },

  async findById(id) {
    return prisma.automationLog.findUnique({
      where: { id },
      include: automationLogInclude
    });
  },

  async create(record) {
    return prisma.automationLog.create({
      data: record,
      include: automationLogInclude
    });
  },

  async listByJobReference(jobReference, take = 8) {
    return prisma.automationLog.findMany({
      where: {
        job_reference: jobReference
      },
      include: automationLogInclude,
      orderBy: {
        executed_at: "desc"
      },
      take
    });
  },

  async count() {
    return prisma.automationLog.count();
  },

  async countByResult() {
    return prisma.automationLog.groupBy({
      by: ["result"],
      _count: { _all: true }
    });
  },

  async countSince(cutoff) {
    return prisma.automationLog.count({
      where: { executed_at: { gte: cutoff } }
    });
  }
};
