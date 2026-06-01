<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

import {
  formatAutomationResult,
  formatEventType,
  formatSourceSystem
} from "@/utils/formatEnums";

const props = defineProps({
  log: {
    type: Object,
    default: null
  }
});

defineEmits(["close"]);

const resultMeta = computed(() => {
  switch (props.log?.result) {
    case "SUCCESS":
      return { tone: "is-success", glyph: "✓", headline: "Run completed successfully." };
    case "FAILED":
      return { tone: "is-warning", glyph: "!", headline: "Run failed and needs attention." };
    case "RETRYING":
      return { tone: "is-review", glyph: "↻", headline: "Run is retrying after a transient issue." };
    default:
      return { tone: "is-active", glyph: "·", headline: "Run status not yet reported." };
  }
});

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
  <div v-if="log" class="modal-overlay" @click.self="$emit('close')">
    <div
      class="modal-panel automation-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="automation-modal-title"
    >
      <header class="modal-header automation-modal-hero" :class="resultMeta.tone">
        <div class="automation-modal-hero-text">
          <span class="automation-modal-kicker">
            {{ formatSourceSystem(log.source_system || "INTERNAL") }}
            <template v-if="log.event_type"> · {{ formatEventType(log.event_type) }}</template>
          </span>
          <h2 id="automation-modal-title">{{ log.process_name }}</h2>
          <p>
            <span class="automation-modal-glyph">{{ resultMeta.glyph }}</span>
            {{ resultMeta.headline }}
          </p>
        </div>
        <button class="modal-close" type="button" aria-label="Close" @click="$emit('close')">×</button>
      </header>

      <div class="modal-body">
        <section v-if="log.error_message" class="modal-callout is-danger">
          <span class="modal-callout-label">What went wrong</span>
          <p>{{ log.error_message }}</p>
          <small v-if="log.retry_attempts">Retried {{ log.retry_attempts }} time(s).</small>
        </section>

        <section v-else-if="log.retry_attempts > 0" class="modal-callout is-info">
          <span class="modal-callout-label">Recovered after retry</span>
          <p>This run succeeded after {{ log.retry_attempts }} retry attempt(s).</p>
        </section>

        <RouterLink
          v-if="log.related_incident"
          :to="`/incidents/${log.related_incident.id}`"
          class="modal-link-card"
        >
          <span class="modal-link-kicker">Linked incident</span>
          <strong>{{ log.related_incident.incident_code }}</strong>
          <span class="modal-link-title">{{ log.related_incident.title }}</span>
          <span class="modal-link-cta">Open incident →</span>
        </RouterLink>

        <section class="modal-section">
          <h3>Timing</h3>
          <dl class="modal-meta">
            <div>
              <dt>Executed</dt>
              <dd>{{ formatTimestamp(log.executed_at) }}</dd>
            </div>
            <div>
              <dt>Captured</dt>
              <dd>{{ formatTimestamp(log.created_at) }}</dd>
            </div>
            <div>
              <dt>Result</dt>
              <dd>{{ formatAutomationResult(log.result) }}</dd>
            </div>
            <div>
              <dt>Retries</dt>
              <dd>{{ log.retry_attempts ?? 0 }}</dd>
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
