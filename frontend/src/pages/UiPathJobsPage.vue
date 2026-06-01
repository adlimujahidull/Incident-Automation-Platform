<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import AutomationTabs from "@/components/AutomationTabs.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import PanelCard from "@/components/PanelCard.vue";
import UiPathJobDetail from "@/components/UiPathJobDetail.vue";
import { uipathService } from "@/services/uipathService";
import { formatJobStatus, formatSourceChannel } from "@/utils/formatEnums";

const route = useRoute();
const router = useRouter();

const jobStatuses = ["RECEIVED", "PROCESSING", "INCIDENT_CREATED", "REVIEW_REQUIRED", "RETRYING", "FAILED", "COMPLETED"];
const sourceChannels = ["EMAIL_QUEUE", "FOLDER_WATCHER", "OCR_QUEUE", "API_BRIDGE"];

const loading = ref(true);
const initialized = ref(false);
const result = ref({ items: [], total: 0, page: 1, pageSize: 25, pageCount: 1, hasMore: false });
const selectedJob = ref(null);
const detailLoading = ref(false);

const filters = reactive({
  query: "",
  status: [],
  source_channel: "",
  related_incident_id: ""
});

const pagination = reactive({ page: 1, pageSize: 25 });

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
  filters.status = parseArrayParam(route.query.status);
  filters.source_channel = String(route.query.source_channel ?? "");
  filters.related_incident_id = String(route.query.related_incident_id ?? "");
  pagination.page = Number(route.query.page ?? 1);
  pagination.pageSize = Number(route.query.pageSize ?? 25);
}

function buildQueryObject() {
  const out = {};

  if (filters.query) out.query = filters.query;
  if (filters.status.length) out.status = filters.status.join(",");
  if (filters.source_channel) out.source_channel = filters.source_channel;
  if (filters.related_incident_id) out.related_incident_id = filters.related_incident_id;
  if (pagination.page !== 1) out.page = String(pagination.page);
  if (pagination.pageSize !== 25) out.pageSize = String(pagination.pageSize);

  return out;
}

async function fetchJobs() {
  loading.value = true;

  try {
    result.value = await uipathService.list({
      query: filters.query || undefined,
      status: filters.status,
      source_channel: filters.source_channel ? [filters.source_channel] : undefined,
      related_incident_id: filters.related_incident_id || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize
    });
  } finally {
    loading.value = false;
  }
}

function syncRoute() {
  router.replace({ path: "/uipath-jobs", query: buildQueryObject() });
}

function applyFilters() {
  pagination.page = 1;
  syncRoute();
}

function resetFilters() {
  filters.query = "";
  filters.status = [];
  filters.source_channel = "";
  filters.related_incident_id = "";
  pagination.page = 1;
  syncRoute();
}

function toggleStatus(value) {
  filters.status = filters.status.includes(value)
    ? filters.status.filter((item) => item !== value)
    : [...filters.status, value];
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

async function openDetail(job) {
  detailLoading.value = true;

  try {
    selectedJob.value = await uipathService.getByJobReference(job.job_reference);
  } catch {
    selectedJob.value = job;
  } finally {
    detailLoading.value = false;
  }
}

function closeDetail() {
  selectedJob.value = null;
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

function statusClass(status) {
  if (status === "COMPLETED") {
    return "status-pill is-success";
  }

  if (status === "FAILED" || status === "REVIEW_REQUIRED") {
    return "status-pill is-warning";
  }

  if (status === "RETRYING") {
    return "status-pill is-review";
  }

  return "status-pill is-active";
}

watch(
  () => route.query,
  () => {
    if (!initialized.value) {
      return;
    }

    readFromRoute();
    fetchJobs();
  }
);

onMounted(async () => {
  readFromRoute();
  await fetchJobs();
  initialized.value = true;
});
</script>

<template>
  <div class="page-grid">
    <AutomationTabs />

    <PanelCard
      title="UiPath Job Filter"
      description="Review inbound robot jobs by reference, status, source channel, or linked incident."
    >
      <form class="fbar" @submit.prevent="applyFilters">
        <div class="fbar-row">
          <input
            v-model="filters.query"
            type="text"
            placeholder="Job reference, process, source, or failure..."
            class="fbar-search"
          />
          <select v-model="filters.source_channel" class="fbar-field">
            <option value="">All channels</option>
            <option v-for="channel in sourceChannels" :key="channel" :value="channel">
              {{ formatSourceChannel(channel) }}
            </option>
          </select>
          <input
            v-model="filters.related_incident_id"
            type="text"
            placeholder="Linked incident code (e.g. INC-...)"
            class="fbar-field"
          />
          <div class="fbar-actions">
            <button class="primary-button" type="submit" :disabled="loading">
              {{ loading ? "Applying..." : "Apply" }}
            </button>
            <button class="secondary-button" type="button" @click="resetFilters">Reset</button>
          </div>
        </div>

        <div class="fbar-chips">
          <span class="fbar-chips-label">Status:</span>
          <button
            v-for="status in jobStatuses"
            :key="status"
            type="button"
            class="chip-toggle"
            :class="{ 'is-active': filters.status.includes(status) }"
            @click="toggleStatus(status)"
          >
            {{ formatJobStatus(status) }}
          </button>
        </div>
      </form>
    </PanelCard>

    <PanelCard
      title="UiPath Execution Jobs"
      :description="`${result.total ?? 0} robot jobs matched the current filters.`"
    >
      <div v-if="loading && !initialized" class="empty-inline">Loading UiPath jobs...</div>

      <template v-else>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Source</th>
                <th>Related incident</th>
                <th>Retries</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody v-if="result.items.length">
              <tr v-for="job in result.items" :key="job.id">
                <td>
                  <strong>{{ job.job_reference }}</strong>
                  <div class="cell-muted">{{ job.process_name }}</div>
                </td>
                <td><span :class="statusClass(job.status)">{{ formatJobStatus(job.status) }}</span></td>
                <td>{{ formatSourceChannel(job.source_channel) }}</td>
                <td>
                  <RouterLink
                    v-if="job.related_incident"
                    :to="`/incidents/${job.related_incident.id}`"
                    class="table-link"
                  >
                    {{ job.related_incident.incident_code }}
                  </RouterLink>
                  <span v-else class="cell-muted">-</span>
                </td>
                <td>{{ job.retry_attempts }}</td>
                <td>{{ formatTimestamp(job.updated_at) }}</td>
                <td>
                  <button class="secondary-button" type="button" @click="openDetail(job)">
                    {{ detailLoading && selectedJob?.job_reference === job.job_reference ? "Loading..." : "View" }}
                  </button>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr>
                <td class="empty-row" colspan="7">No UiPath jobs match these filters yet.</td>
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

    <UiPathJobDetail :job="selectedJob" @close="closeDetail" />
  </div>
</template>
