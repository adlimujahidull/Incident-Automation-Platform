import { prisma } from "../lib/prisma.js";

const incidentInclude = {
  assigned_to: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true
    }
  },
  duplicate_parent: {
    select: {
      id: true,
      incident_code: true,
      title: true,
      status: true
    }
  },
  ai_analyses: {
    select: {
      id: true,
      confidence_score: true,
      duplicate_confidence: true,
      provider: true,
      created_at: true
    },
    orderBy: { created_at: "desc" },
    take: 1
  }
};

const activeStatuses = ["NEW", "PROCESSING", "OPEN", "ASSIGNED", "IN REVIEW"];
const unresolvedStatuses = ["NEW", "PROCESSING", "OPEN", "ASSIGNED", "IN REVIEW", "FAILED"];

function bucketToStatusFilter(bucket) {
  switch (bucket) {
    case "active":
      return { in: activeStatuses };
    case "unresolved":
      return { in: unresolvedStatuses };
    case "duplicates":
      return { equals: "DUPLICATE" };
    case "rejected":
      return { equals: "REJECTED" };
    case "closed":
      return { in: ["CLOSED", "RESOLVED"] };
    case "critical":
      return undefined;
    default:
      return undefined;
  }
}

function buildIncidentWhere(filters) {
  const conditions = [];
  const normalizedQuery = String(filters.query ?? "").trim();

  if (normalizedQuery) {
    conditions.push({
      OR: [
        { incident_code: { contains: normalizedQuery, mode: "insensitive" } },
        { title: { contains: normalizedQuery, mode: "insensitive" } },
        { summary: { contains: normalizedQuery, mode: "insensitive" } },
        { source_type: { contains: normalizedQuery, mode: "insensitive" } }
      ]
    });
  }

  if (filters.status?.length) {
    conditions.push({ status: { in: filters.status } });
  }

  if (filters.priority?.length) {
    conditions.push({ priority: { in: filters.priority } });
  }

  if (filters.category?.length) {
    conditions.push({ category: { in: filters.category } });
  }

  if (filters.department?.length) {
    conditions.push({ assigned_department: { in: filters.department } });
  }

  if (filters.source_type?.length) {
    conditions.push({ source_type: { in: filters.source_type } });
  }

  if (filters.assignee) {
    if (filters.assignee === "unassigned") {
      conditions.push({ assigned_to_user_id: null });
    } else {
      conditions.push({ assigned_to_user_id: filters.assignee });
    }
  }

  if (filters.tags?.length) {
    conditions.push({ tags: { hasSome: filters.tags } });
  }

  if (filters.creator) {
    conditions.push({
      created_by: { contains: filters.creator, mode: "insensitive" }
    });
  }

  if (filters.from || filters.to) {
    conditions.push({
      created_at: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {})
      }
    });
  }

  if (filters.bucket) {
    if (filters.bucket === "critical") {
      conditions.push({ priority: "Critical" });
      conditions.push({ status: { notIn: ["RESOLVED", "CLOSED", "REJECTED"] } });
    } else {
      const bucketStatus = bucketToStatusFilter(filters.bucket);
      if (bucketStatus) {
        conditions.push({ status: bucketStatus });
      }
    }
  }

  return conditions.length ? { AND: conditions } : {};
}

function buildIncidentOrderBy(filters) {
  const sortBy = filters.sortBy ?? "created_at";
  const sortDir = filters.sortDir ?? "desc";

  if (sortBy === "priority") {
    return [{ priority: sortDir }, { created_at: "desc" }];
  }

  return [{ [sortBy]: sortDir }];
}

export const incidentRepository = {
  async list(filters = {}) {
    const where = buildIncidentWhere(filters);
    const orderBy = buildIncidentOrderBy(filters);
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    const [items, total] = await prisma.$transaction([
      prisma.incident.findMany({
        where,
        include: incidentInclude,
        orderBy,
        skip: offset,
        take: pageSize
      }),
      prisma.incident.count({ where })
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
    return prisma.incident.findUnique({
      where: { id },
      include: incidentInclude
    });
  },

  async findByIncidentCode(incidentCode) {
    return prisma.incident.findUnique({
      where: {
        incident_code: incidentCode
      },
      include: incidentInclude
    });
  },

  async create(record, client = prisma) {
    return client.incident.create({
      data: record,
      include: incidentInclude
    });
  },

  async update(id, patch, client = prisma) {
    return client.incident.update({
      where: { id },
      data: patch,
      include: incidentInclude
    });
  },

  async addHistory(entry, client = prisma) {
    return client.incidentHistory.create({
      data: entry
    });
  },

  async listHistory(incidentId) {
    return prisma.incidentHistory.findMany({
      where: {
        incident_id: incidentId
      },
      orderBy: {
        changed_at: "desc"
      }
    });
  },

  async addAttachment(attachment, client = prisma) {
    return client.incidentAttachment.create({
      data: attachment
    });
  },

  async findAttachmentById(id) {
    return prisma.incidentAttachment.findUnique({
      where: { id }
    });
  },

  async listAttachmentsByIds(ids) {
    return prisma.incidentAttachment.findMany({
      where: {
        id: {
          in: ids
        }
      },
      orderBy: {
        uploaded_at: "desc"
      }
    });
  },

  async listAttachments(incidentId) {
    return prisma.incidentAttachment.findMany({
      where: {
        incident_id: incidentId
      },
      orderBy: {
        uploaded_at: "desc"
      }
    });
  },

  async listStagedAttachments({ uploadedBy, sourceType, limit = 12 }) {
    return prisma.incidentAttachment.findMany({
      where: {
        incident_id: null,
        uploaded_by: uploadedBy,
        ingestion_status: "STAGED",
        ...(sourceType ? { source_type: sourceType } : {})
      },
      orderBy: {
        uploaded_at: "desc"
      },
      take: limit
    });
  },

  async linkAttachments(attachmentIds, patch, client = prisma) {
    await client.incidentAttachment.updateMany({
      where: {
        id: {
          in: attachmentIds
        }
      },
      data: patch
    });

    return client.incidentAttachment.findMany({
      where: {
        id: {
          in: attachmentIds
        }
      },
      orderBy: {
        uploaded_at: "desc"
      }
    });
  },

  async addComment(comment) {
    return prisma.incidentComment.create({
      data: comment
    });
  },

  async addAiAnalysis(record, client = prisma) {
    return client.incidentAiAnalysis.create({
      data: record
    });
  },

  async findAiAnalysisById(id) {
    return prisma.incidentAiAnalysis.findUnique({
      where: { id }
    });
  },

  async listAiAnalyses(incidentId, limit = 5) {
    return prisma.incidentAiAnalysis.findMany({
      where: {
        incident_id: incidentId
      },
      orderBy: {
        created_at: "desc"
      },
      take: limit
    });
  },

  async listComments(incidentId) {
    return prisma.incidentComment.findMany({
      where: {
        incident_id: incidentId
      },
      orderBy: {
        created_at: "desc"
      }
    });
  },

  async listRecent(days) {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

    return prisma.incident.findMany({
      where: {
        created_at: {
          gte: new Date(cutoffTime)
        }
      },
      include: incidentInclude,
      orderBy: {
        created_at: "desc"
      }
    });
  },

  async listAll() {
    return prisma.incident.findMany({
      include: incidentInclude,
      orderBy: {
        created_at: "desc"
      }
    });
  },

  async countAll() {
    return prisma.incident.count();
  },

  async listRecentHistory(limit = 8) {
    return prisma.incidentHistory.findMany({
      orderBy: {
        changed_at: "desc"
      },
      take: limit
    });
  },

  async countByStatus() {
    return prisma.incident.groupBy({
      by: ["status"],
      _count: { _all: true }
    });
  },

  async countByPriority() {
    return prisma.incident.groupBy({
      by: ["priority"],
      _count: { _all: true }
    });
  },

  async countByCategory() {
    return prisma.incident.groupBy({
      by: ["category"],
      _count: { _all: true }
    });
  },

  async countByDepartmentAndStatus() {
    return prisma.incident.groupBy({
      by: ["assigned_department", "status"],
      _count: { _all: true }
    });
  },

  async countBySourceType() {
    return prisma.incident.groupBy({
      by: ["source_type"],
      _count: { _all: true }
    });
  },

  async totalsRollup() {
    const [total, critical, duplicates, unresolved, active, awaitingAi] = await prisma.$transaction([
      prisma.incident.count(),
      prisma.incident.count({
        where: {
          priority: "Critical",
          status: { notIn: ["RESOLVED", "CLOSED", "REJECTED"] }
        }
      }),
      prisma.incident.count({ where: { status: "DUPLICATE" } }),
      prisma.incident.count({
        where: { status: { notIn: ["RESOLVED", "CLOSED", "REJECTED"] } }
      }),
      prisma.incident.count({
        where: { status: { in: activeStatuses } }
      }),
      prisma.incident.count({
        where: {
          status: { notIn: ["RESOLVED", "CLOSED", "REJECTED"] },
          ai_analyses: { none: {} }
        }
      })
    ]);

    return { total, critical, duplicates, unresolved, active, awaiting_ai: awaitingAi };
  },

  async listSinceCreatedAt(cutoff) {
    return prisma.incident.findMany({
      where: { created_at: { gte: cutoff } },
      select: { id: true, status: true, created_at: true, priority: true }
    });
  },

  async listSinceResolvedAt(cutoff) {
    return prisma.incidentHistory.findMany({
      where: {
        changed_at: { gte: cutoff },
        new_status: "RESOLVED"
      },
      select: { id: true, incident_id: true, changed_at: true }
    });
  },

  async listRecentIncidents(limit) {
    return prisma.incident.findMany({
      include: incidentInclude,
      orderBy: { created_at: "desc" },
      take: limit
    });
  }
};
