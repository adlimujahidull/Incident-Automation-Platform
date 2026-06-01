<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";

import IncidentTimeline from "@/components/IncidentTimeline.vue";
import PanelCard from "@/components/PanelCard.vue";
import { automationService } from "@/services/automationService";
import { incidentService } from "@/services/incidentService";
import { formatRole } from "@/utils/formatRole";
import { formatAutomationResult, formatStatus } from "@/utils/formatEnums";

const route = useRoute();

const loading = ref(true);
const incident = ref(null);
const automationRuns = ref({ items: [], total: 0 });
const automationLoading = ref(true);

const statusClassMap = {
  RESOLVED: "is-success",
  CLOSED: "is-success",
  REJECTED: "is-warning",
  FAILED: "is-warning",
  DUPLICATE: "is-warning",
  "IN REVIEW": "is-review",
  IN_REVIEW: "is-review",
  ASSIGNED: "is-assigned"
};

function statusClass(status) {
  return ["status-pill", statusClassMap[status] ?? "is-active"].join(" ");
}

function priorityClass(priority) {
  return ["priority-chip", priority ? `is-${priority.toLowerCase()}` : ""].join(" ");
}

function formatTimestamp(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

const summary = computed(() => {
  if (!incident.value) {
    return [];
  }

  return [
    { label: "Incident", value: incident.value.incident_code },
    { label: "Created", value: formatTimestamp(incident.value.created_at) },
    { label: "Last update", value: formatTimestamp(incident.value.updated_at) },
    {
      label: "Assigned to",
      value: incident.value.assigned_to ? `${incident.value.assigned_to.name} (${formatRole(incident.value.assigned_to.role)})` : "Unassigned"
    }
  ];
});

async function loadIncident() {
  loading.value = true;

  try {
    incident.value = await incidentService.getById(route.params.id);
  } finally {
    loading.value = false;
  }
}

async function loadAutomationRuns() {
  automationLoading.value = true;

  try {
    automationRuns.value = await automationService.list({
      related_incident_id: route.params.id,
      pageSize: 25
    });
  } catch {
    automationRuns.value = { items: [], total: 0 };
  } finally {
    automationLoading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadIncident(), loadAutomationRuns()]);
});
</script>

<template>
  <div class="page-grid">
    <div v-if="loading" class="empty-inline">Loading timeline...</div>

    <template v-else-if="incident">
      <PanelCard :title="incident.title" :description="`Audit timeline for ${incident.incident_code}`">
        <template #actions>
          <RouterLink class="secondary-button" :to="`/incidents/${incident.id}`">
            Back to detail
          </RouterLink>
        </template>

        <div class="timeline-summary">
          <span :class="statusClass(incident.status)">{{ formatStatus(incident.status) }}</span>
          <span :class="priorityClass(incident.priority)">{{ incident.priority }}</span>
          <span class="cell-muted">{{ incident.assigned_department }}</span>
        </div>

        <dl class="timeline-meta">
          <div v-for="item in summary" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </PanelCard>

      <PanelCard
        title="Workflow Timeline"
        description="Chronological audit trail covering status changes, assignments, evidence, and discussion."
      >
        <IncidentTimeline :history="incident.history" :comments="incident.comments" />
      </PanelCard>

      <PanelCard
        title="Linked Automation Runs"
        :description="`${automationRuns.total ?? 0} automation execution(s) tied to this incident.`"
      >
        <div v-if="automationLoading" class="empty-inline">Loading automation history...</div>
        <div v-else-if="!automationRuns.items.length" class="empty-inline">
          No automation runs are linked to this incident yet.
        </div>
        <div v-else class="table-wrap">
          <table class="data-table compact">
            <thead>
              <tr>
                <th>Process</th>
                <th>Result</th>
                <th>Retries</th>
                <th>Error</th>
                <th>Executed</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="run in automationRuns.items" :key="run.id">
                <td>{{ run.process_name }}</td>
                <td>
                  <span :class="['status-pill', run.result === 'SUCCESS' ? 'is-success' : run.result === 'FAILED' ? 'is-warning' : 'is-review']">
                    {{ formatAutomationResult(run.result) }}
                  </span>
                </td>
                <td>{{ run.retry_attempts }}</td>
                <td class="cell-muted">{{ run.error_message ?? "—" }}</td>
                <td>{{ formatTimestamp(run.executed_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PanelCard>
    </template>
  </div>
</template>
