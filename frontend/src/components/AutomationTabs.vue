<script setup>
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";

const route = useRoute();

const tabs = [
  {
    key: "jobs",
    label: "Robot Jobs",
    description: "Each row is one UiPath execution",
    to: "/uipath-jobs"
  },
  {
    key: "events",
    label: "Event Ledger",
    description: "Each row is one automation event",
    to: "/automation-logs"
  }
];

const activeKey = computed(() => (route.path.startsWith("/automation-logs") ? "events" : "jobs"));
</script>

<template>
  <div class="automation-tabs">
    <div class="automation-tabs-row">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.key"
        :to="tab.to"
        class="automation-tab"
        :class="{ 'is-active': activeKey === tab.key }"
      >
        <strong>{{ tab.label }}</strong>
        <span>{{ tab.description }}</span>
      </RouterLink>
    </div>
  </div>
</template>
