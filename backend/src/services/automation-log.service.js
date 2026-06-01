import { automationResults } from "../constants/incident.constants.js";
import { automationLogRepository } from "../repositories/automation-log.repository.js";
import { HttpError } from "../utils/http-error.js";

function mapResultCounts(rows) {
  const lookup = new Map(rows.map((row) => [row.result, row._count?._all ?? 0]));
  return automationResults.map((result) => ({
    result,
    count: lookup.get(result) ?? 0
  }));
}

export const automationLogService = {
  async listLogs(filters = {}) {
    return automationLogRepository.list(filters);
  },

  async listRecent(take) {
    return automationLogRepository.list({ take });
  },

  async getLog(id) {
    const log = await automationLogRepository.findById(id);

    if (!log) {
      throw new HttpError(404, "Automation log not found");
    }

    return log;
  },

  async listByJobReference(jobReference, take = 8) {
    return automationLogRepository.listByJobReference(jobReference, take);
  },

  async createLog(payload) {
    return automationLogRepository.create({
      ...payload,
      executed_at: payload.executed_at ?? new Date()
    });
  },

  async countLogs() {
    return automationLogRepository.count();
  },

  async getActivitySummary() {
    const last24hCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7dCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [resultCounts, total, last24hRuns, last7dRuns] = await Promise.all([
      automationLogRepository.countByResult(),
      automationLogRepository.count(),
      automationLogRepository.countSince(last24hCutoff),
      automationLogRepository.countSince(last7dCutoff)
    ]);

    return {
      total,
      last_24h: last24hRuns,
      last_7d: last7dRuns,
      by_result: mapResultCounts(resultCounts)
    };
  }
};
