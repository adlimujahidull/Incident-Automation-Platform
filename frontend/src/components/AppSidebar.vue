<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { useSessionStore } from "@/stores/session";
import { hasPermission } from "@/utils/authorization";
import { formatRole } from "@/utils/formatRole";

const route = useRoute();
const router = useRouter();
const sessionStore = useSessionStore();

const navigation = [
  { label: "Dashboard", to: "/dashboard", permission: "view_dashboard" },
  { label: "Incidents", to: "/incidents", permission: "view_incidents" },
  { label: "Automation", to: "/automation", permission: "view_automation_logs", matchPrefixes: ["/automation", "/uipath-jobs", "/automation-logs"] },
  { label: "Users", to: "/users", permission: "view_users" }
];

const savedViews = [
  { label: "Active queue", bucket: "active" },
  { label: "Critical unresolved", bucket: "critical" },
  { label: "Unresolved", bucket: "unresolved" },
  { label: "Duplicates", bucket: "duplicates" }
];

const currentPath = computed(() => route.path);
const currentBucket = computed(() => String(route.query.bucket ?? ""));

const visibleNavigation = computed(() =>
  navigation.filter((item) => hasPermission(sessionStore.user, item.permission))
);

const canViewIncidents = computed(() => hasPermission(sessionStore.user, "view_incidents"));
const canViewSettings = computed(() => hasPermission(sessionStore.user, "view_settings"));

const user = computed(() => sessionStore.user);

const initials = computed(() => {
  if (!user.value?.name) return "?";
  return user.value.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
});

const menuOpen = ref(false);

function isNavActive(item) {
  const prefixes = item.matchPrefixes ?? [item.to];

  return prefixes.some((prefix) => {
    if (!currentPath.value.startsWith(prefix)) {
      return false;
    }

    if (prefix === "/incidents" && currentBucket.value) {
      return false;
    }

    return true;
  });
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function closeMenu() {
  menuOpen.value = false;
}

function openSettings() {
  closeMenu();
  router.push("/settings");
}

async function handleLogout() {
  closeMenu();
  await sessionStore.logout();
  router.push("/login");
}

function handleDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest(".sidebar-profile")) {
    closeMenu();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("click", handleDocumentClick);
  onBeforeUnmount(() => document.removeEventListener("click", handleDocumentClick));
}
</script>

<template>
  <aside class="app-sidebar">
    <div class="sidebar-top">
      <div class="brand-block">
        <span class="brand-kicker">DHL DAC 3.0</span>
        <strong>Incident Operations Platform</strong>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in visibleNavigation"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ 'is-active': isNavActive(item) }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div v-if="canViewIncidents" class="sidebar-section">
        <span class="sidebar-section-label">Saved views</span>
        <div class="sidebar-subnav">
          <RouterLink
            v-for="view in savedViews"
            :key="view.bucket"
            :to="{ path: '/incidents', query: { bucket: view.bucket } }"
            class="nav-link is-sub"
            :class="{ 'is-active': currentPath === '/incidents' && currentBucket === view.bucket }"
          >
            {{ view.label }}
          </RouterLink>
        </div>
      </div>
    </div>

    <div v-if="user" class="sidebar-profile" :class="{ 'is-open': menuOpen }">
      <div v-if="menuOpen" class="sidebar-profile-menu" role="menu">
        <div class="sidebar-profile-menu-header">
          <strong>{{ user.name }}</strong>
          <span>{{ user.email }}</span>
        </div>
        <button
          v-if="canViewSettings"
          class="sidebar-profile-menu-item"
          type="button"
          role="menuitem"
          @click="openSettings"
        >
          Platform Settings
        </button>
        <button
          class="sidebar-profile-menu-item is-danger"
          type="button"
          role="menuitem"
          @click="handleLogout"
        >
          Sign Out
        </button>
      </div>

      <button
        class="sidebar-profile-trigger"
        type="button"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        @click.stop="toggleMenu"
      >
        <span class="profile-avatar">{{ initials }}</span>
        <span class="profile-identity">
          <strong>{{ user.name }}</strong>
          <span>{{ formatRole(user.role) }}</span>
        </span>
        <span class="profile-chevron" aria-hidden="true">▴</span>
      </button>
    </div>
  </aside>
</template>
