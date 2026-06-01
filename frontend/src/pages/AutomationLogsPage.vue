<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import AutomationLogDetail from "@/components/AutomationLogDetail.vue";
import AutomationTabs from "@/components/AutomationTabs.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import PanelCard from "@/components/PanelCard.vue";
import { automationService } from "@/services/automationService";
import {
  formatAutomationResult,
  formatEventType,
  formatSourceSystem
} from "@/utils/formatEnums";

const route = useRoute();
const router = useRouter();

const automationResults = ["SUCCESS", "FAILED", "RETRYING"];
const automationSources = ["UIPATH", "INTERNAL"];

const loading = ref(true);
const initialized = ref(false);
const result = ref({ items: [], total: 0, page: 1, pageSize: 25, pageCount: 1, hasMore: false });

const filters = reactive({
  query: "",
  result: [],
  source_system: "",
  related_incident_id: "",
  from: "",
  to: ""
});

const pagination = reactive({ page: 1, pageSize: 25 });

const selectedLog = ref(null);
const detailLoading = ref(false);

function parseArrayParam(value) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseArrayParam(entry));
  }

  if (typeof value !== "string" || !value) {
    return [];
  }

  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function readFromRoute() {
  filters.query = String(route.query.query ?? "");
  filters.result = parseArrayParam(route.query.result);
  filters.source_system = String(route.query.source_system ?? "");
  filters.related_incident_id = String(route.query.related_incident_id ?? "");
  filters.from = String(route.query.from ?? "");
  filters.to = String(route.query.to ?? "");
  pagination.page = Number(route.query.page ?? 1);
  pagination.pageSize = Number(route.query.pageSize ?? 25);
}

function buildQueryObject() {
  const out = {};

  if (filters.query) out.query = filters.query;
  if (filters.result.length) out.result = filters.result.join(",");
  if (filters.source_system) out.source_system = filters.source_system;
  if (filters.related_incident_id) out.related_incident_id = filters.related_incident_id;
  if (filters.from) out.from = filters.from;
  if (filters.to) out.to = filters.to;
  if (pagination.page !== 1) out.page = String(pagination.page);
  if (pagination.pageSize !== 25) out.pageSize = String(pagination.pageSize);

  return out;
}

function toIsoBoundary(value, endOfDay) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date.toISOString();
}

async function fetchLogs() {
  loading.value = true;

  try {
    result.value = await automationService.list({
      query: filters.query || undefined,
      result: filters.result,
      source_system: filters.source_system ? [filters.source_system] : undefined,
      related_incident_id: filters.related_incident_id || undefined,
      from: toIsoBoundary(filters.from, false),
      to: toIsoBoundary(filters.to, true),
      page: pagination.page,
      pageSize: pagination.pageSize
    });
  } finally {
    loading.value = false;
  }
}

function syncRoute() {
  router.replace({ path: "/automation-logs", query: buildQueryObject() });
}

function applyFilters() {
  pagination.page = 1;
  syncRoute();
}

function resetFilters() {
  filters.query = "";
  filters.result = [];
  filters.source_system = "";
  filters.related_incident_id = "";
  filters.from = "";
  filters.to = "";
  pagination.page = 1;
  syncRoute();
}

function toggleResult(value) {
  filters.result = filters.result.includes(value)
    ? filters.result.filter((item) => item !== value)
    : [...filters.result, value];
}

function handlePageChange(next) {
  pagination.page = next;
  syncRoute();
}

function handlePageSizeChange(next) {
  pagination.pageSize = next;
  pagination.page = 1;
  syncRoute();
}

async function openDetail(log) {
  detailLoading.value = true;

  try {
    selectedLog.value = await automationService.getById(log.id);
  } catch {
    selectedLog.value = log;
  } finally {
    detailLoading.value = false;
  }
}

function closeDetail() {
  selectedLog.value = null;
}

function resultClass(value) {
  if (value === "SUCCESS") {
    return "status-pill is-success";
  }

  if (value === "FAILED") {
    return "status-pill is-warning";
  }

  return "status-pill is-review";
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function truncate(value, max = 80) {
  if (!value) {
    return "-";
  }

  const text = String(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

watch(
  () => route.query,
  () => {
    if (!initialized.value) {
      return;
    }

    readFromRoute();
    fetchLogs();
  }
);

onMounted(async () => {
  readFromRoute();
  await fetchLogs();
  initialized.value = true;
});
</script>

<template>
  <div class="page-grid">
    <AutomationTabs />

    <PanelCard
      title="Automation Filter"
      description="Narrow execution records by source system, result, related incident, or time window."
    >
      <form class="fbar" @submit.prevent="applyFilters">
        <div class="fbar-row">
          <input
            v-model="filters.query"
            type="text"
            class="fbar-search"
            placeholder="Process, event, job reference, or error keyword"
          />
          <select v-model="filters.source_system" class="fbar-field">
            <option value="">All sources</option>
            <option v-for="source in automationSources" :key="source" :value="source">
              {{ formatSourceSystem(source) }}
            </option>
          </select>
          <input
            v-model="filters.related_incident_id"
            type="text"
            class="fbar-field"
            placeholder="Linked incident code (e.g. INC-...)"
          />
          <input v-model="filters.from" type="date" class="fbar-date" />
          <input v-model="filters.to" type="date" class="fbar-date" />
          <div class="fbar-actions">
            <button class="primary-button" type="submit" :disabled="loading">
              {{ loading ? "Applying..." : "Apply Filters" }}
            </button>
            <button class="secondary-button" type="button" @click="resetFilters">Reset</button>
          </div>
        </div>

        <div class="fbar-chips">
          <span class="fbar-chips-label">Result</span>
          <button
            v-for="value in automationResults"
            :key="value"
            type="button"
            class="chip-toggle"
            :class="{ 'is-active': filters.result.includes(value) }"
            @click="toggleResult(value)"
          >
            {{ formatAutomationResult(value) }}
          </button>
        </div>
      </form>
    </PanelCard>

    <PanelCard
      title="Execution Ledger"
      :description="`${result.total ?? 0} automation runs matched the current filters.`"
    >
      <div v-if="loading && !initialized" class="empty-inline">Loading automation logs...</div>

      <template v-else>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Process</th>
                <th>Source</th>
                <th>Result</th>
                <th>Error</th>
                <th>Related incident</th>
                <th>Retries</th>
                <th>Executed</th>
                <th></th>
              </tr>
            </thead>
            <tbody v-if="result.items.length">
              <tr v-for="log in result.items" :key="log.id">
                <td>
                  <strong>{{ log.process_name }}</strong>
                  <div class="cell-muted">{{ formatTimestamp(log.created_at) }}</div>
                </td>
                <td>
                  <div>{{ formatSourceSystem(log.source_system || "INTERNAL") }}</div>
                  <div class="cell-muted">{{ log.event_type ? formatEventType(log.event_type) : "—" }}</div>
                </td>
                <td><span :class="resultClass(log.result)">{{ formatAutomationResult(log.result) }}</span></td>
                <td>{{ truncate(log.error_message) }}</td>
                <td>
                  <RouterLink
                    v-if="log.related_incident"
                    :to="`/incidents/${log.related_incident.id}`"
                    class="table-link"
                  >
                    {{ log.related_incident.incident_code }}
                  </RouterLink>
                  <span v-else class="cell-muted">-</span>
                </td>
                <td>{{ log.retry_attempts }}</td>
                <td>{{ formatTimestamp(log.executed_at) }}</td>
                <td>
                  <button class="secondary-button" type="button" @click="openDetail(log)">
                    {{ detailLoading && selectedLog?.id === log.id ? "Loading..." : "View" }}
                  </button>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr>
                <td class="empty-row" colspan="8">No automation runs match these filters yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <PaginationBar
          :page="result.page"
          :page-size="result.pageSize"
          :total="result.total"
          :page-count="result.pageCount"
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </template>
    </PanelCard>

    <AutomationLogDetail :log="selectedLog" @close="closeDetail" />
  </div>
</template>
