import { uipathService } from "../services/uipath.service.js";

function buildBaseUrl(request) {
  return `${request.protocol}://${request.get("host")}`;
}

export const uipathController = {
  async manifest(request, response) {
    response.json({
      manifest: uipathService.getManifest(buildBaseUrl(request))
    });
  },

  async listJobs(request, response) {
    const result = await uipathService.listJobs(request.query);
    response.json(result);
  },

  async getJob(request, response) {
    const job = await uipathService.getJob(request.params.jobReference);
    response.json({ job });
  },

  async summarizeJob(request, response) {
    const result = await uipathService.generateJobSummary(request.params.jobReference);
    response.json(result);
  },

  async intake(request, response) {
    const result = await uipathService.receiveIntake(request.body);
    response.status(result.idempotent ? 200 : 201).json(result);
  },

  async updateStatus(request, response) {
    const job = await uipathService.updateJobStatus(request.params.jobReference, request.body);
    response.json({ job });
  },

  async duplicateCheck(request, response) {
    const result = await uipathService.checkDuplicateHash(request.body);
    response.json(result);
  },

  async recordRunSummary(request, response) {
    const result = await uipathService.recordRunSummary(request.body);
    response.status(201).json(result);
  }
};
