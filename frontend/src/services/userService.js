import { apiClient } from "./api";

export const userService = {
  async list() {
    const { data } = await apiClient.get("/users");
    return data.items;
  }
};

