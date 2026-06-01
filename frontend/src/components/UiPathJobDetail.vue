<script setup>
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";

import { uipathService } from "@/services/uipathService";
import {
  formatJobStatus,
  formatSourceChannel
} from "@/utils/formatEnums";

const props = defineProps({
  job: {
    type: Object,
    default: null
  }
});

defineEmits(["close"]);

const summary = ref(null);
const summaryLoading = ref(false);

const statusMeta = computed(() => {
  switch (props.job?.status) {
    case "COMPLETED":
      return { tone: "is-success", glyph: "✓", headline: "Run completed without intervention." };
    case "INCIDENT_CREATED":
      return { tone: "is-success", glyph: "✓", headline: "Run created an incident and handed it to the team." };
    case "FAILED":
      return { tone: "is-warning", glyph: "!", headline: "Run failed and needs operator follow-up." };
    case "REVIEW_REQUIRED":
      return { tone: "is-warning", glyph: "!", headline: "Run paused — manual review is required before it can continue." };
    case "RETRYING":
      return { tone: "is-review", glyph: "↻", headline: "Run is retrying after a transient failure." };
    case "PROCESSING":
      return { tone: "is-review", glyph: "·", headline: "Run is currently in progress." };
    default:
      return { tone: "is-active", glyph: "·", headline: "Run has been received and is awaiting processing." };
  }
});

async function loadSummary() {
  if (!props.job) return;
  summaryLoading.value = true;
  summary.value = null;
  try {
    summary.value = await uipathService.summarizeJob(props.job.job_reference);
  } catch {
    summary.value = null;
  } finally {
    summaryLoading.value = false;
  }
}

watch(
  () => props.job?.job_reference,
  (reference) => {
    if (reference) {
      loadSummary();
    } else {
      summary.value = null;
      summaryLoading.value = false;
    }
  },
  { immediate: true }
);

function formatTimestamp(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
</script>

<template>
  <div v-if="job" class="modal-overlay" @click.self="$emit('close')">
    <div
      class="modal-panel automation-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="uipath-job-modal-title"
    >
      <header class="modal-header automation-modal-hero" :class="statusMeta.tone">
        <div class="automation-modal-hero-text">
          <span class="automation-modal-kicker">
            {{ formatSourceChannel(job.source_channel) }} · {{ formatJobStatus(job.status) }}
          </span>
          <h2 id="uipath-job-modal-title">{{ job.process_name }}</h2>
          <p>
            <span class="automation-modal-glyph">{{ statusMeta.glyph }}</span>
            {{ statusMeta.headline }}
          </p>
        </div>
        <button class="modal-close" type="button" aria-label="Close" @click="$emit('close')">×</button>
      </header>

      <div class="modal-body">
        <section class="modal-section">
          <h3>At a glance</h3>
          <p v-if="summaryLoading" class="empty-inline" style="padding: 0;">Preparing summary…</p>
          <p v-else-if="summary" class="modal-summary-text">{{ summary }}</p>
          <p v-else class="empty-inline" style="padding: 0;">No summary available for this run yet.</p>
        </section>

        <section v-if="job.failure_reason" class="modal-callout is-danger">
          <span class="modal-callout-label">Why it failed</span>
          <p>{{ job.failure_reason }}</p>
          <small v-if="job.retry_attempts">Retried {{ job.retry_attempts }} time(s) before failing.</small>
        </section>

        <section v-if="job.workflow_warning" class="modal-callout is-warning">
          <span class="modal-callout-label">Workflow warning</span>
          <p>{{ job.workflow_warning }}</p>
        </section>

        <RouterLink
          v-if="job.related_incident"
          :to="`/incidents/${job.related_incident.id}`"
          class="modal-link-card"
        >
          <span class="modal-link-kicker">Linked incident</span>
          <strong>{{ job.related_incident.incident_code }}</strong>
          <span class="modal-link-title">{{ job.related_incident.title }}</span>
          <span class="modal-link-cta">Open incident →</span>
        </RouterLink>

        <section class="modal-section">
          <h3>Timing</h3>
          <dl class="modal-meta">
            <div>
              <dt>Last update</dt>
              <dd>{{ formatTimestamp(job.last_callback_at) }}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{{ formatTimestamp(job.completed_at) }}</dd>
            </div>
            <div v-if="job.retry_attempts > 0">
              <dt>Retry attempts</dt>
              <dd>{{ job.retry_attempts }}</dd>
            </div>
            <div>
              <dt>Job status</dt>
              <dd>{{ formatJobStatus(job.status) }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <footer class="modal-footer">
        <button class="secondary-button" type="button" @click="$emit('close')">Close</button>
      </footer>
    </div>
  </div>
</template>
