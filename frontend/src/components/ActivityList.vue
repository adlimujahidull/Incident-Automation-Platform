<script setup>
import { formatAction, formatAutomationResult } from "@/utils/formatEnums";

defineProps({
  items: {
    type: Array,
    default: () => []
  },
  emptyMessage: {
    type: String,
    default: "No activity available."
  }
});

function formatDate(value) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function headlineFor(item) {
  if (item.action) return formatAction(item.action);
  if (item.process_name) return item.process_name;
  return item.title || "Operational update";
}

function detailFor(item) {
  if (item.comment) return item.comment;
  if (item.result) return formatAutomationResult(item.result);
  if (item.summary) return item.summary;
  return "Operational event captured.";
}
</script>

<template>
  <ul v-if="items.length" class="activity-list">
    <li v-for="item in items" :key="item.id" class="activity-row">
      <div>
        <strong>{{ headlineFor(item) }}</strong>
        <p>{{ detailFor(item) }}</p>
      </div>
      <span>{{ formatDate(item.changed_at ?? item.executed_at ?? item.updated_at ?? item.created_at) }}</span>
    </li>
  </ul>
  <div v-else class="empty-inline">{{ emptyMessage }}</div>
</template>

