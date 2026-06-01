<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";

import AppSidebar from "@/components/AppSidebar.vue";
import TopbarBar from "@/components/TopbarBar.vue";

const route = useRoute();

const pageMeta = computed(() => {
  const entries = {
    "/dashboard": {
      title: "Operational Dashboard",
      subtitle: "Monitor intake, workflow distribution, and automation execution."
    },
    "/incidents": {
      title: "Incident Workspace",
      subtitle: "Search and review active incidents across departments."
    },
    "/automation-logs": {
      title: "Automation Logs",
      subtitle: "Track outcomes from UiPath robots and intake automation."
    },
    "/uipath-jobs": {
      title: "UiPath Jobs",
      subtitle: "Review robot intake jobs, callback outcomes, and linked incidents."
    },
    "/users": {
      title: "User Directory",
      subtitle: "Browse operational accounts and the departments they cover."
    },
    "/settings": {
      title: "Platform Settings",
      subtitle: "Review the live status of AI and automation integrations."
    }
  };

  if (route.path.endsWith("/timeline")) {
    return {
      title: "Incident Timeline",
      subtitle: "Chronological audit trail of status changes, assignments, evidence, and discussion."
    };
  }

  if (route.path.startsWith("/incidents/")) {
    return {
      title: "Incident Detail",
      subtitle: "Review full context, history, and routing decisions."
    };
  }

  return entries[route.path] ?? entries["/dashboard"];
});
</script>

<template>
  <div class="app-frame">
    <AppSidebar />

    <div class="app-main">
      <TopbarBar :title="pageMeta.title" :subtitle="pageMeta.subtitle" />

      <main class="page-content">
        <router-view />
      </main>
    </div>
  </div>
</template>
