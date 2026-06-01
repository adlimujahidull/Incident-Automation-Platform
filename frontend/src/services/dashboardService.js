import { apiClient } from "./api";

export const dashboardService = {
  async getSummary() {
    const { data } = await apiClient.get("/dashboard/summary");
    return data;
  }
};

