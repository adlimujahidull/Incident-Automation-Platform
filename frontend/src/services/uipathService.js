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

export const uipathService = {
  async getManifest() {
    const { data } = await apiClient.get("/uipath/manifest");
    return data.manifest;
  },

  async list(filters = {}) {
    const { data } = await apiClient.get("/uipath/jobs", {
      params: flattenArrayParams(filters)
    });

    return data;
  },

  async getByJobReference(jobReference) {
    const { data } = await apiClient.get(`/uipath/jobs/${jobReference}`);
    return data.job;
  },

  async summarizeJob(jobReference) {
    const { data } = await apiClient.post(`/uipath/jobs/${jobReference}/summarize`);
    return data.summary;
  }
};
