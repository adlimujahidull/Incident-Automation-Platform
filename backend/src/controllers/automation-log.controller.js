import { automationLogService } from "../services/automation-log.service.js";

export const automationLogController = {
  async list(request, response) {
    const result = await automationLogService.listLogs(request.query);
    response.json(result);
  },

  async getById(request, response) {
    const log = await automationLogService.getLog(request.params.id);
    response.json({ log });
  },

  async create(request, response) {
    const log = await automationLogService.createLog(request.body);
    response.status(201).json({ log });
  }
};
