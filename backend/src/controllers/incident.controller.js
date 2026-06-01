import { incidentService } from "../services/incident.service.js";

export const incidentController = {
  async list(request, response) {
    const result = await incidentService.listIncidents(request.query);
    response.json(result);
  },

  async getById(request, response) {
    const incident = await incidentService.getIncident(request.params.id);
    response.json({ incident });
  },

  async create(request, response) {
    const incident = await incidentService.createIncident(request.body, request.user?.email ?? "system");
    response.status(201).json({ incident });
  },

  async update(request, response) {
    const incident = await incidentService.updateIncident(
      request.params.id,
      request.body,
      request.user?.email ?? "system"
    );
    response.json({ incident });
  },

  async updateStatus(request, response) {
    const incident = await incidentService.updateStatus(
      request.params.id,
      request.body,
      request.user?.email ?? "system"
    );

    response.json({ incident });
  },

  async assign(request, response) {
    const incident = await incidentService.assignIncident(
      request.params.id,
      request.body,
      request.user?.email ?? "system"
    );

    response.json({ incident });
  },

  async addComment(request, response) {
    const incident = await incidentService.addComment(
      request.params.id,
      request.body,
      request.user?.email ?? "system"
    );

    response.status(201).json({ incident });
  },

  async runAiAnalysis(request, response) {
    const incident = await incidentService.runAiAnalysis(request.params.id, request.user?.email ?? "system");
    response.status(201).json({ incident });
  },

  async applyAiAnalysis(request, response) {
    const incident = await incidentService.applyAiAnalysis(
      request.params.id,
      request.params.analysisId,
      request.body,
      request.user?.email ?? "system"
    );

    response.json({ incident });
  },

  async listAssignees(_request, response) {
    const users = await incidentService.listAssignableUsers();
    response.json({ items: users });
  },

  async getHistory(request, response) {
    const incident = await incidentService.getIncident(request.params.id);
    response.json({
      history: incident.history
    });
  },

  async archive(request, response) {
    const result = await incidentService.archiveIncident(
      request.params.id,
      request.body,
      request.user?.email ?? "system"
    );

    response.json(result);
  }
};
