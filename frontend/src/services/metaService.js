import { apiClient } from "./api";

export const metaService = {
  async getIncidentOptions() {
    const { data } = await apiClient.get("/meta/incident-options");
    return data;
  }
};
