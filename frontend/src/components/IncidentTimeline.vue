<script setup>
import { computed } from "vue";

import { formatAction, formatActor, formatStatus } from "@/utils/formatEnums";

const props = defineProps({
  history: {
    type: Array,
    default: () => []
  },
  comments: {
    type: Array,
    default: () => []
  },
  emptyMessage: {
    type: String,
    default: "No timeline events captured yet."
  }
});

function actionLabel(action) {
  return formatAction(action);
}

function actionToneClass(action) {
  if (["INCIDENT_RESOLVED"].includes(action)) {
    return "is-success";
  }

  if (["INCIDENT_REJECTED", "INCIDENT_FAILED", "DUPLICATE_DETECTED", "MARKED_DUPLICATE"].includes(action)) {
    return "is-warning";
  }

  if (["INCIDENT_ASSIGNED", "INCIDENT_REASSIGNED"].includes(action)) {
    return "is-assigned";
  }

  if (["STATUS_CHANGED", "FAILURE_RECOVERY_STARTED", "INCIDENT_REOPENED"].includes(action)) {
    return "is-review";
  }

  if (["COMMENT_ADDED"].includes(action)) {
    return "is-active";
  }

  return "";
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

const timeline = computed(() => {
  const entries = [
    ...props.history.map((entry) => ({
      kind: "history",
      timestamp: entry.changed_at,
      payload: entry,
      key: `h-${entry.id}`
    })),
    ...props.comments.map((entry) => ({
      kind: "comment",
      timestamp: entry.created_at,
      payload: entry,
      key: `c-${entry.id}`
    }))
  ];

  return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
});
</script>

<template>
  <div v-if="timeline.length" class="timeline">
    <article
      v-for="entry in timeline"
      :key="entry.key"
      class="timeline-entry"
      :class="`is-${entry.kind}`"
    >
      <div class="timeline-marker" />
      <div class="timeline-body">
        <header class="timeline-header">
          <span v-if="entry.kind === 'history'" class="status-pill" :class="actionToneClass(entry.payload.action)">
            {{ actionLabel(entry.payload.action) }}
          </span>
          <span v-else class="status-pill is-review">Comment posted</span>

          <span class="timeline-actor">{{ formatActor(entry.payload.changed_by ?? entry.payload.comment_by) }}</span>
          <span class="timeline-time">{{ formatTimestamp(entry.timestamp) }}</span>
        </header>

        <div v-if="entry.kind === 'history'" class="timeline-content">
          <p v-if="entry.payload.old_status || entry.payload.new_status" class="timeline-transition">
            <span v-if="entry.payload.old_status">{{ formatStatus(entry.payload.old_status) }}</span>
            <span v-if="entry.payload.old_status && entry.payload.new_status && entry.payload.old_status !== entry.payload.new_status" class="timeline-arrow">→</span>
            <span v-if="entry.payload.new_status && entry.payload.new_status !== entry.payload.old_status">
              {{ formatStatus(entry.payload.new_status) }}
            </span>
          </p>
          <p v-if="entry.payload.comment" class="timeline-comment">{{ entry.payload.comment }}</p>
        </div>

        <div v-else class="timeline-content">
          <p class="timeline-comment">{{ entry.payload.body }}</p>
        </div>
      </div>
    </article>
  </div>
  <div v-else class="empty-inline">{{ emptyMessage }}</div>
</template>
