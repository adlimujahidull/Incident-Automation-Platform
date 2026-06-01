import { automationLogService } from "../services/automation-log.service.js";
import { incidentService } from "../services/incident.service.js";

export const dashboardController = {
  async getSummary(_request, response) {
    const [summary, automationActivity, automationSummary] = await Promise.all([
      incidentService.getDashboardSummary(),
      automationLogService.listRecent(8),
      automationLogService.getActivitySummary()
    ]);

    response.json({
      ...summary,
      automation_activity: automationActivity,
      automation_summary: automationSummary
    });
  }
};
