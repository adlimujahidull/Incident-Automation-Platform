<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import IncidentFilterPanel from "@/components/IncidentFilterPanel.vue";
import IncidentTable from "@/components/IncidentTable.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import PanelCard from "@/components/PanelCard.vue";
import { incidentService } from "@/services/incidentService";
import { metaService } from "@/services/metaService";
import { useSessionStore } from "@/stores/session";
import { hasPermission } from "@/utils/authorization";

const route = useRoute();
const router = useRouter();
const sessionStore = useSessionStore();

const loading = ref(false);
const initialized = ref(false);
const result = ref({
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  pageCount: 1,
  hasMore: false
});

const options = ref({
  statuses: [],
  priorities: [],
  categories: [],
  departments: [],
  source_types: []
});

const assignees = ref([]);

const bucketLabels = {
  active: "Active queue",
  unresolved: "Unresolved",
  critical: "Critical unresolved",
  duplicates: "Duplicate alerts",
  rejected: "Rejected",
  closed: "Resolved / Closed"
};

const defaultFilters = () => ({
  query: "",
  status: [],
  priority: [],
  category: [],
  department: [],
  source_type: [],
  assignee: "",
  bucket: "",
  from: "",
  to: "",
  tags: [],
  creator: ""
});

const filters = reactive(defaultFilters());

const sort = reactive({
  sortBy: "created_at",
  sortDir: "desc"
});

const pagination = reactive({
  page: 1,
  pageSize: 25
});

const canCreateIncidents = computed(() => hasPermission(sessionStore.user, "create_incidents"));
const canViewAssignees = computed(() => hasPermission(sessionStore.user, "assign_incidents"));
const bucketLabel = computed(() => bucketLabels[filters.bucket] ?? null);

function parseArrayParam(value) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseArrayParam(entry));
  }

  if (typeof value !== "string" || !value) {
    return [];
  }

  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function readFiltersFromRoute() {
  const queryParams = route.query;
  filters.query = String(queryParams.query ?? "");
  filters.status = parseArrayParam(queryParams.status);
  filters.priority = parseArrayParam(queryParams.priority);
  filters.category = parseArrayParam(queryParams.category);
  filters.department = parseArrayParam(queryParams.department);
  filters.source_type = parseArrayParam(queryParams.source_type);
  filters.assignee = String(queryParams.assignee ?? "");
  filters.bucket = String(queryParams.bucket ?? "");
  filters.from = String(queryParams.from ?? "");
  filters.to = String(queryParams.to ?? "");
  filters.tags = parseArrayParam(queryParams.tags);
  filters.creator = String(queryParams.creator ?? "");
  sort.sortBy = String(queryParams.sortBy ?? "created_at");
  sort.sortDir = String(queryParams.sortDir ?? "desc");
  pagination.page = Number(queryParams.page ?? 1);
  pagination.pageSize = Number(queryParams.pageSize ?? 25);
}

function buildQueryObject() {
  const out = {};

  if (filters.query) out.query = filters.query;
  if (filters.status.length) out.status = filters.status.join(",");
  if (filters.priority.length) out.priority = filters.priority.join(",");
  if (filters.category.length) out.category = filters.category.join(",");
  if (filters.department.length) out.department = filters.department.join(",");
  if (filters.source_type.length) out.source_type = filters.source_type.join(",");
  if (filters.assignee) out.assignee = filters.assignee;
  if (filters.bucket) out.bucket = filters.bucket;
  if (filters.from) out.from = filters.from;
  if (filters.to) out.to = filters.to;
  if (filters.tags.length) out.tags = filters.tags.join(",");
  if (filters.creator) out.creator = filters.creator;
  if (sort.sortBy !== "created_at") out.sortBy = sort.sortBy;
  if (sort.sortDir !== "desc") out.sortDir = sort.sortDir;
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

async function fetchIncidents() {
  loading.value = true;

  try {
    const data = await incidentService.list({
      query: filters.query || undefined,
      status: filters.status,
      priority: filters.priority,
      category: filters.category,
      department: filters.department,
      source_type: filters.source_type,
      assignee: filters.assignee || undefined,
      bucket: filters.bucket || undefined,
      from: toIsoBoundary(filters.from, false),
      to: toIsoBoundary(filters.to, true),
      tags: filters.tags,
      creator: filters.creator || undefined,
      sortBy: sort.sortBy,
      sortDir: sort.sortDir,
      page: pagination.page,
      pageSize: pagination.pageSize
    });

    result.value = data;
  } finally {
    loading.value = false;
  }
}

function syncRoute() {
  router.replace({ path: "/incidents", query: buildQueryObject() });
}

function applyFilters() {
  pagination.page = 1;
  syncRoute();
}

function resetFilters() {
  Object.assign(filters, defaultFilters());
  pagination.page = 1;
  syncRoute();
}

function handleSort(event) {
  sort.sortBy = event.sortBy;
  sort.sortDir = event.sortDir;
  pagination.page = 1;
  syncRoute();
}

function clearBucket() {
  filters.bucket = "";
  pagination.page = 1;
  syncRoute();
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

function updateFilters(next) {
  Object.assign(filters, next);
}

watch(
  () => route.query,
  () => {
    if (!initialized.value) {
      return;
    }

    readFiltersFromRoute();
    fetchIncidents();
  }
);

onMounted(async () => {
  readFiltersFromRoute();
  const metaPromise = metaService.getIncidentOptions().catch(() => {
    console.error("Failed to fetch incident filter options.");
    return options.value; // Return existing (empty) options on error
  });
  const assigneesPromise = canViewAssignees.value
    ? incidentService.listAssignees().catch(() => [])
    : Promise.resolve([]);

  const [metaResult, assigneesResult] = await Promise.all([metaPromise, assigneesPromise]);
  options.value = metaResult;
  assignees.value = assigneesResult ?? [];

  await fetchIncidents();
  initialized.value = true;
});
</script>

<template>
  <div class="page-grid">
    <PanelCard
      title="Incident Search"
      description="Combine keyword and chip filters to narrow the operational register."
    >
      <IncidentFilterPanel
        :model-value="filters"
        :options="options"
        :assignees="assignees"
        :busy="loading"
        @update:model-value="updateFilters"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </PanelCard>

    <PanelCard
      title="Incident register"
      :description="`${result.total} incident(s) match the current filters.`"
    >
      <template #actions>
        <RouterLink v-if="canCreateIncidents" class="primary-button" to="/incidents/new">
          Submit new incident
        </RouterLink>
      </template>

      <div v-if="bucketLabel" class="bucket-banner">
        <span>Saved view: <strong>{{ bucketLabel }}</strong></span>
        <button class="secondary-button" type="button" @click="clearBucket">Clear</button>
      </div>

      <div v-if="!initialized" class="empty-inline">Loading incidents…</div>
      <template v-else>
        <IncidentTable
          :incidents="result.items"
          :sort-by="sort.sortBy"
          :sort-dir="sort.sortDir"
          sortable
          :show-assignee="canViewAssignees"
          :show-ai-signal="canViewAssignees"
          empty-message="No incidents match these filters. Try clearing one or two chips."
          @sort="handleSort"
        />

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
  </div>
</template>
