import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const apiClient = axios.create({
  baseURL
});

export function setAccessToken(token) {
  apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function clearAccessToken() {
  delete apiClient.defaults.headers.common.Authorization;
}

