<script setup>
import { RouterLink } from "vue-router";

import { formatPriority, formatStatus } from "@/utils/formatEnums";

const props = defineProps({
  incidents: {
    type: Array,
    default: () => []
  },
  sortBy: {
    type: String,
    default: "updated_at"
  },
  sortDir: {
    type: String,
    default: "desc"
  },
  sortable: {
    type: Boolean,
    default: false
  },
  emptyMessage: {
    type: String,
    default: "No incidents match the current filters."
  },
  showAssignee: {
    type: Boolean,
    default: false
  },
  showAiSignal: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["sort"]);

const baseColumns = [
  { key: "incident_code", label: "Case", sortable: true, always: true },
  { key: "priority", label: "Priority", sortable: true, always: true },
  { key: "status", label: "Status", sortable: true, always: true },
  { key: "assigned_department", label: "Department", sortable: false, always: true },
  { key: "assignee", label: "Owner", sortable: false, optional: "showAssignee" },
  { key: "ai", label: "AI confidence", sortable: false, optional: "showAiSignal" },
  { key: "updated_at", label: "Last update", sortable: true, always: true }
];

function visibleColumns() {
  return baseColumns.filter((column) => column.always || props[column.optional]);
}

function aiConfidenceClass(value) {
  if (value === null || value === undefined) return "ai-chip is-pending";
  if (value >= 0.75) return "ai-chip is-high";
  if (value >= 0.5) return "ai-chip is-medium";
  return "ai-chip is-low";
}

function formatConfidence(value) {
  if (value === null || value === undefined) return "Pending";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function priorityClass(priority) {
  switch (priority) {
    case "Critical":
      return "priority-chip is-critical";
    case "High":
      return "priority-chip is-high";
    case "Medium":
      return "priority-chip is-medium";
    case "Low":
      return "priority-chip is-low";
    default:
      return "priority-chip";
  }
}

function statusClass(status) {
  if (["RESOLVED", "CLOSED"].includes(status)) return "status-pill is-success";
  if (["REJECTED", "FAILED", "DUPLICATE"].includes(status)) return "status-pill is-warning";
  if (["IN REVIEW", "IN_REVIEW"].includes(status)) return "status-pill is-review";
  if (status === "ASSIGNED") return "status-pill is-assigned";
  return "status-pill is-active";
}

function handleSort(column) {
  if (!props.sortable || !column.sortable) return;
  const nextDir = props.sortBy === column.key && props.sortDir === "desc" ? "asc" : "desc";
  emit("sort", { sortBy: column.key, sortDir: nextDir });
}

function sortGlyph(column) {
  if (!props.sortable || !column.sortable) return "";
  if (props.sortBy !== column.key) return "↕";
  return props.sortDir === "asc" ? "↑" : "↓";
}
</script>

<template>
  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th
            v-for="column in visibleColumns()"
            :key="column.key"
            :class="{ 'is-sortable': sortable && column.sortable, 'is-active-sort': sortBy === column.key }"
            @click="handleSort(column)"
          >
            <span class="th-content">
              {{ column.label }}
              <span v-if="sortable && column.sortable" class="sort-glyph">{{ sortGlyph(column) }}</span>
            </span>
          </th>
        </tr>
      </thead>
      <tbody v-if="incidents.length">
        <tr v-for="incident in incidents" :key="incident.id">
          <td>
            <RouterLink :to="`/incidents/${incident.id}`" class="table-link">
              {{ incident.incident_code }}
            </RouterLink>
            <div class="table-primary">{{ incident.title }}</div>
            <div class="cell-muted">{{ incident.category || "Uncategorised" }}</div>
          </td>
          <td><span :class="priorityClass(incident.priority)">{{ formatPriority(incident.priority) || "—" }}</span></td>
          <td><span :class="statusClass(incident.status)">{{ formatStatus(incident.status) || "—" }}</span></td>
          <td>{{ incident.assigned_department || "—" }}</td>
          <td v-if="showAssignee">
            <template v-if="incident.assigned_to">
              <span class="cell-strong">{{ incident.assigned_to.name }}</span>
            </template>
            <span v-else class="cell-muted">Unassigned</span>
          </td>
          <td v-if="showAiSignal">
            <span :class="aiConfidenceClass(incident.latest_ai_confidence)">
              {{ formatConfidence(incident.latest_ai_confidence) }}
            </span>
          </td>
          <td>{{ formatDate(incident.updated_at) }}</td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr>
          <td :colspan="visibleColumns().length" class="empty-row">{{ emptyMessage }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
