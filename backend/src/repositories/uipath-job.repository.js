import { prisma } from "../lib/prisma.js";

const uipathJobInclude = {
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

function buildUiPathJobWhere(filters = {}) {
  const conditions = [];
  const normalizedQuery = String(filters.query ?? "").trim();

  if (normalizedQuery) {
    conditions.push({
      OR: [
        { job_reference: { contains: normalizedQuery, mode: "insensitive" } },
        { process_name: { contains: normalizedQuery, mode: "insensitive" } },
        { source_reference: { contains: normalizedQuery, mode: "insensitive" } },
        { failure_reason: { contains: normalizedQuery, mode: "insensitive" } }
      ]
    });
  }

  if (filters.status?.length) {
    conditions.push({ status: { in: filters.status } });
  }

  if (filters.source_channel?.length) {
    conditions.push({ source_channel: { in: filters.source_channel } });
  }

  if (filters.related_incident_id) {
    conditions.push({ related_incident_id: filters.related_incident_id });
  }

  return conditions.length ? { AND: conditions } : {};
}

export const uipathJobRepository = {
  async list(filters = {}) {
    const where = buildUiPathJobWhere(filters);
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    const [items, total] = await prisma.$transaction([
      prisma.uiPathJob.findMany({
        where,
        include: uipathJobInclude,
        orderBy: { updated_at: "desc" },
        skip: offset,
        take: pageSize
      }),
      prisma.uiPathJob.count({ where })
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

  async findByJobReference(jobReference) {
    return prisma.uiPathJob.findUnique({
      where: { job_reference: jobReference },
      include: uipathJobInclude
    });
  },

  async create(record) {
    return prisma.uiPathJob.create({
      data: record,
      include: uipathJobInclude
    });
  },

  async updateByJobReference(jobReference, patch) {
    return prisma.uiPathJob.update({
      where: { job_reference: jobReference },
      data: patch,
      include: uipathJobInclude
    });
  }
};
