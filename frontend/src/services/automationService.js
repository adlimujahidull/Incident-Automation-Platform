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

export const automationService = {
  async list(filters = {}) {
    const { data } = await apiClient.get("/automation/logs", {
      params: flattenArrayParams(filters)
    });
    return data;
  },

  async getById(id) {
    const { data } = await apiClient.get(`/automation/logs/${id}`);
    return data.log;
  }
};

