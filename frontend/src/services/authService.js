import { apiClient } from "./api";

export const authService = {
  async login(credentials) {
    const { data } = await apiClient.post("/auth/login", credentials);
    return data;
  },

  async me() {
    const { data } = await apiClient.get("/auth/me");
    return data.user;
  },

  async logout() {
    const { data } = await apiClient.post("/auth/logout");
    return data;
  }
};
