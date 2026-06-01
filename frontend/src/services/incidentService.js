import { apiClient } from "./api";

function flattenArrayParams(params) {
  const result = {};

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }

      result[key] = value.join(",");
      continue;
    }

    result[key] = value;
  }

  return result;
}

export const incidentService = {
  async list(filters = {}) {
    const { data } = await apiClient.get("/incidents", {
      params: flattenArrayParams(filters)
    });

    return data;
  },

  async getById(id) {
    const { data } = await apiClient.get(`/incidents/${id}`);
    return data.incident;
  },

  async create(payload) {
    const { data } = await apiClient.post("/incidents", payload);
    return data.incident;
  },

  async listAssignees() {
    const { data } = await apiClient.get("/incidents/assignees");
    return data.items;
  },

  async assign(id, payload) {
    const { data } = await apiClient.patch(`/incidents/${id}/assignment`, payload);
    return data.incident;
  },

  async updateStatus(id, payload) {
    const { data } = await apiClient.patch(`/incidents/${id}/status`, payload);
    return data.incident;
  },

  async addComment(id, payload) {
    const { data } = await apiClient.post(`/incidents/${id}/comments`, payload);
    return data.incident;
  },

  async runAiAnalysis(id) {
    const { data } = await apiClient.post(`/incidents/${id}/ai-analyses`);
    return data.incident;
  },

  async applyAiAnalysis(id, analysisId, payload) {
    const { data } = await apiClient.post(`/incidents/${id}/ai-analyses/${analysisId}/apply`, payload);
    return data.incident;
  },

  async getHistory(id) {
    const { data } = await apiClient.get(`/incidents/${id}/history`);
    return data.history;
  },

  async archive(id, payload) {
    const { data } = await apiClient.delete(`/incidents/${id}`, { data: payload });
    return data;
  }
};
