import { defineStore } from "pinia";

import { clearAccessToken, setAccessToken } from "@/services/api";
import { authService } from "@/services/authService";

const storageKey = "dhl-session";

export const useSessionStore = defineStore("session", {
  state: () => ({
    token: null,
    user: null,
    loading: false,
    initializing: false,
    initialized: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.token && state.user)
  },

  actions: {
    restoreSession() {
      const persisted = window.localStorage.getItem(storageKey);

      if (!persisted) {
        clearAccessToken();
        return;
      }

      try {
        const parsed = JSON.parse(persisted);
        this.token = parsed.token;
        this.user = parsed.user;
        setAccessToken(parsed.token);
      } catch {
        this.token = null;
        this.user = null;
        this.error = null;
        clearAccessToken();
        window.localStorage.removeItem(storageKey);
      }
    },

    async initializeSession() {
      this.initializing = true;
      this.restoreSession();

      try {
        if (!this.token) {
          return;
        }

        const currentUser = await authService.me();
        this.user = currentUser;
        this.persistSession();
      } catch {
        await this.logout();
      } finally {
        this.initializing = false;
        this.initialized = true;
      }
    },

    persistSession() {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          token: this.token,
          user: this.user
        })
      );
    },

    async login(credentials) {
      this.loading = true;
      this.error = null;

      try {
        const session = await authService.login(credentials);
        this.token = session.token;
        this.user = session.user;
        setAccessToken(session.token);
        this.persistSession();
        return session;
      } catch (error) {
        this.error = error.response?.data?.message ?? "Unable to sign in";
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      if (this.token) {
        try {
          await authService.logout();
        } catch {
          // Client-side logout should still proceed if the API request fails.
        }
      }

      this.token = null;
      this.user = null;
      this.error = null;
      clearAccessToken();
      window.localStorage.removeItem(storageKey);
    }
  }
});
