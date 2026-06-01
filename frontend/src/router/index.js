import { createRouter, createWebHistory } from "vue-router";

import AppShell from "@/layouts/AppShell.vue";
import AutomationLogsPage from "@/pages/AutomationLogsPage.vue";
import CreateIncidentPage from "@/pages/CreateIncidentPage.vue";
import DashboardPage from "@/pages/DashboardPage.vue";
import IncidentDetailPage from "@/pages/IncidentDetailPage.vue";
import IncidentListPage from "@/pages/IncidentListPage.vue";
import IncidentTimelinePage from "@/pages/IncidentTimelinePage.vue";
import LoginPage from "@/pages/LoginPage.vue";
import NotFoundPage from "@/pages/NotFoundPage.vue";
import SettingsPage from "@/pages/SettingsPage.vue";
import UiPathJobsPage from "@/pages/UiPathJobsPage.vue";
import UnauthorizedPage from "@/pages/UnauthorizedPage.vue";
import UserListPage from "@/pages/UserListPage.vue";
import { pinia } from "@/stores/pinia";
import { useSessionStore } from "@/stores/session";
import { hasPermission } from "@/utils/authorization";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: LoginPage,
      meta: { guestOnly: true }
    },
    {
      path: "/",
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          redirect: "/dashboard"
        },
        {
          path: "dashboard",
          name: "dashboard",
          component: DashboardPage,
          meta: { requiredPermission: "view_dashboard" }
        },
        {
          path: "incidents",
          name: "incidents",
          component: IncidentListPage,
          meta: { requiredPermission: "view_incidents" }
        },
        {
          path: "incidents/new",
          name: "incident-create",
          component: CreateIncidentPage,
          meta: { requiredPermission: "create_incidents" }
        },
        {
          path: "incidents/:id",
          name: "incident-detail",
          component: IncidentDetailPage,
          meta: { requiredPermission: "view_incidents" }
        },
        {
          path: "incidents/:id/timeline",
          name: "incident-timeline",
          component: IncidentTimelinePage,
          meta: { requiredPermission: "view_incidents" }
        },
        {
          path: "automation",
          name: "automation",
          redirect: "/uipath-jobs"
        },
        {
          path: "automation-logs",
          name: "automation-logs",
          component: AutomationLogsPage,
          meta: { requiredPermission: "view_automation_logs" }
        },
        {
          path: "uipath-jobs",
          name: "uipath-jobs",
          component: UiPathJobsPage,
          meta: { requiredPermission: "view_automation_logs" }
        },
        {
          path: "users",
          name: "users",
          component: UserListPage,
          meta: { requiredPermission: "view_users" }
        },
        {
          path: "settings",
          name: "settings",
          component: SettingsPage,
          meta: { requiredPermission: "view_settings" }
        }
      ]
    },
    {
      path: "/unauthorized",
      name: "unauthorized",
      component: UnauthorizedPage,
      meta: { requiresAuth: true }
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: NotFoundPage
    }
  ]
});

router.beforeEach((to) => {
  const sessionStore = useSessionStore(pinia);
  const isAuthenticated = sessionStore.isAuthenticated;

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: "login" };
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return { name: "dashboard" };
  }

  if (to.meta.requiredPermission && !hasPermission(sessionStore.user, to.meta.requiredPermission)) {
    return { name: "unauthorized" };
  }

  return true;
});

export default router;
