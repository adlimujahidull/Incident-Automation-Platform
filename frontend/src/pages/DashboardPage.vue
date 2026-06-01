<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";

import ActivityList from "@/components/ActivityList.vue";
import BarBreakdown from "@/components/BarBreakdown.vue";
import IncidentTable from "@/components/IncidentTable.vue";
import PanelCard from "@/components/PanelCard.vue";
import SummaryStrip from "@/components/SummaryStrip.vue";
import TrendChart from "@/components/TrendChart.vue";
import WorkflowDistribution from "@/components/WorkflowDistribution.vue";
import { dashboardService } from "@/services/dashboardService";
import { useSessionStore } from "@/stores/session";
import { hasPermission } from "@/utils/authorization";
import { formatPriority } from "@/utils/formatEnums";

const sessionStore = useSessionStore();

const loading = ref(true);
const refreshing = ref(false);
const lastRefreshedAt = ref(null);
let refreshInterval = null;
const summary = ref({
  totals: {},
  workflow_distribution: [],
  priority_distribution: [],
  category_distribution: [],
  source_distribution: [],
  department_workload: [],
  trend_series: [],
  recent_incidents: [],
  recent_activities: [],
  automation_activity: [],
  automation_summary: { total: 0, last_24h: 0, last_7d: 0, by_result: [] }
});

const role = computed(() => sessionStore.user?.role ?? "SUPPORT_STAFF");
const firstName = computed(() => sessionStore.user?.name?.split(" ")[0] ?? "team");

const canViewAutomation = computed(() => hasPermission(sessionStore.user, "view_automation_logs"));
const canCreateIncident = computed(() => hasPermission(sessionStore.user, "create_incidents"));

const greeting = computed(() => {
  if (role.value === "ADMIN") {
    return {
      title: `Good day, ${firstName.value}`,
      subtitle: "Here is the operational health of the platform right now."
    };
  }

  if (role.value === "REVIEWER") {
    return {
      title: `Hello, ${firstName.value}`,
      subtitle: "Focus on the triage queue, critical cases, and AI-assisted routing."
    };
  }

  return {
    title: `Welcome, ${firstName.value}`,
    subtitle: "Submit a new report or open one you have raised previously."
  };
});

const baseSummary = {
  total_incidents: { label: "All cases", valueKey: "total_incidents", hint: "Captured across all sources" },
  active_incidents: {
    label: "Active queue",
    valueKey: "active_incidents",
    hint: "New, open, or under review",
    to: { path: "/incidents", query: { bucket: "active" } }
  },
  critical_incidents: {
    label: "Critical",
    valueKey: "critical_incidents",
    hint: "Unresolved high-priority cases",
    to: { path: "/incidents", query: { bucket: "critical" } }
  },
  unresolved_incidents: {
    label: "Unresolved",
    valueKey: "unresolved_incidents",
    hint: "Still awaiting closure",
    to: { path: "/incidents", query: { bucket: "unresolved" } }
  },
  awaiting_ai_incidents: {
    label: "Awaiting AI review",
    valueKey: "awaiting_ai_incidents",
    hint: "Open cases still without AI triage",
    to: { path: "/incidents", query: { bucket: "unresolved" } }
  }
};

const summaryItems = computed(() => {
  const keys =
    role.value === "SUPPORT_STAFF"
      ? ["total_incidents", "active_incidents", "unresolved_incidents"]
      : role.value === "REVIEWER"
        ? ["active_incidents", "critical_incidents", "awaiting_ai_incidents", "unresolved_incidents"]
        : ["total_incidents", "active_incidents", "critical_incidents", "unresolved_incidents", "awaiting_ai_incidents"];

  return keys.map((key) => ({
    key,
    label: baseSummary[key].label,
    hint: baseSummary[key].hint,
    to: baseSummary[key].to,
    value: summary.value.totals[baseSummary[key].valueKey] ?? 0
  }));
});

const summaryColsClass = computed(() => {
  const length = summaryItems.value.length;
  if (length <= 3) return "is-cols-3";
  if (length === 4) return "is-cols-4";
  return "";
});

const lastRefreshedLabel = computed(() => {
  if (!lastRefreshedAt.value) return "";
  return new Intl.DateTimeFormat("en-MY", { hour: "2-digit", minute: "2-digit" }).format(lastRefreshedAt.value);
});

async function loadSummary(isRefresh = false) {
  if (isRefresh) {
    refreshing.value = true;
  } else {
    loading.value = true;
  }

  try {
    summary.value = await dashboardService.getSummary();
    lastRefreshedAt.value = new Date();
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

onMounted(() => {
  loadSummary();
  refreshInterval = setInterval(() => loadSummary(true), 60000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<template>
  <div class="page-grid">
    <section class="dashboard-hero">
      <div class="dashboard-hero-copy">
        <h1>{{ greeting.title }}</h1>
        <p>{{ greeting.subtitle }}</p>
      </div>
      <div class="dashboard-hero-actions">
        <span v-if="lastRefreshedLabel" class="dashboard-hero-meta">Updated at {{ lastRefreshedLabel }}</span>
        <button class="secondary-button" type="button" :disabled="refreshing" @click="loadSummary(true)">
          {{ refreshing ? "Refreshing…" : "Refresh" }}
        </button>
        <RouterLink v-if="canCreateIncident" to="/incidents/new" class="primary-button">
          Submit new incident
        </RouterLink>
      </div>
    </section>

    <SummaryStrip :items="summaryItems" :class-name="summaryColsClass" />

    <div v-if="loading" class="empty-inline">Loading dashboard…</div>

    <template v-else>
      <!-- Support staff see only their own work queue, no analytics -->
      <template v-if="role === 'SUPPORT_STAFF'">
        <PanelCard
          title="Your recent submissions"
          description="The cases you and your team have raised most recently."
        >
          <template #actions>
            <RouterLink class="secondary-button" to="/incidents">Open register</RouterLink>
          </template>
          <IncidentTable
            :incidents="summary.recent_incidents"
            empty-message="You have not submitted any incidents yet. Use “Submit new incident” to get started."
          />
        </PanelCard>
      </template>

      <!-- Reviewer & Admin: full operational view -->
      <template v-else>
        <div class="dashboard-grid">
          <PanelCard
            class="dashboard-grid-trend"
            title="14-day incident flow"
            description="New incidents vs. confirmed resolutions per day."
          >
            <TrendChart :series="summary.trend_series" />
          </PanelCard>

          <PanelCard
            class="dashboard-grid-workflow"
            title="Where cases are sitting"
            description="Click any status to open the filtered register."
          >
            <WorkflowDistribution :items="summary.workflow_distribution" />
          </PanelCard>
        </div>

        <PanelCard
          title="Priority mix"
          description="Distribution of all captured incidents by priority."
        >
          <BarBreakdown
            :items="summary.priority_distribution"
            label-key="priority"
            :label-formatter="formatPriority"
            empty-message="No incidents captured for this view yet."
          />
        </PanelCard>

        <PanelCard
          v-if="role === 'ADMIN'"
          title="Department workload"
          description="Open, in-review, and resolved cases by responsible team."
        >
          <div class="table-wrap">
            <table class="data-table compact">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Open</th>
                  <th>In review</th>
                  <th>Resolved</th>
                  <th>Other</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody v-if="summary.department_workload.length">
                <tr v-for="item in summary.department_workload" :key="item.department">
                  <td>
                    <RouterLink
                      :to="{ path: '/incidents', query: { department: item.department } }"
                      class="table-link"
                    >
                      {{ item.department }}
                    </RouterLink>
                  </td>
                  <td>{{ item.open }}</td>
                  <td>{{ item.in_review }}</td>
                  <td>{{ item.resolved }}</td>
                  <td>{{ item.other }}</td>
                  <td><strong>{{ item.total }}</strong></td>
                </tr>
              </tbody>
              <tbody v-else>
                <tr>
                  <td class="empty-row" colspan="6">No incidents have been routed to a department yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </PanelCard>

        <PanelCard
          title="Latest incidents"
          description="Most recently created or updated cases entering the workflow."
        >
          <template #actions>
            <RouterLink class="secondary-button" to="/incidents">Open full register</RouterLink>
          </template>
          <IncidentTable
            :incidents="summary.recent_incidents"
            empty-message="No incidents have been created yet."
          />
        </PanelCard>

        <PanelCard
          title="Recent workflow activity"
          description="Status changes and actions on incidents across the team."
        >
          <template v-if="canViewAutomation" #actions>
            <RouterLink class="secondary-button" to="/automation-logs">Open automation log</RouterLink>
          </template>
          <ActivityList
            :items="summary.recent_activities"
            empty-message="No workflow activity recorded yet."
          />
        </PanelCard>
      </template>
    </template>
  </div>
</template>
