<script setup>
import { computed, onMounted, ref } from "vue";

import PanelCard from "@/components/PanelCard.vue";
import { uipathService } from "@/services/uipathService";

const loading = ref(true);
const manifest = ref(null);
const loadError = ref("");

async function loadManifest() {
  loading.value = true;
  loadError.value = "";

  try {
    manifest.value = await uipathService.getManifest();
  } catch (error) {
    loadError.value = error.response?.data?.message ?? "Unable to load integration status";
  } finally {
    loading.value = false;
  }
}

const aiStatus = computed(() => {
  if (manifest.value?.ai?.configured) {
    return { label: "Active", tone: "success" };
  }
  return { label: "Standby", tone: "muted" };
});

const uipathStatus = computed(() => {
  if (manifest.value?.auth?.secret_configured) {
    return { label: "Connected", tone: "success" };
  }
  return { label: "Awaiting credentials", tone: "warning" };
});

onMounted(loadManifest);
</script>

<template>
  <div class="page-grid">
    <PanelCard
      title="Integration Status"
      description="Live status of the platform's AI triage and UiPath automation connections."
    >
      <div v-if="loading" class="empty-inline">Loading status...</div>
      <div v-else-if="loadError" class="empty-inline">{{ loadError }}</div>
      <div v-else class="settings-grid">
        <article class="status-card">
          <div class="status-card-header">
            <strong>AI Triage</strong>
            <span :class="['status-badge', `is-${aiStatus.tone}`]">{{ aiStatus.label }}</span>
          </div>
          <p>
            Provides automatic summarization, classification, and duplicate review when an incident
            is opened. Suggestions are always confirmed by a reviewer before being applied.
          </p>
        </article>

        <article class="status-card">
          <div class="status-card-header">
            <strong>UiPath Automation</strong>
            <span :class="['status-badge', `is-${uipathStatus.tone}`]">{{ uipathStatus.label }}</span>
          </div>
          <p v-if="manifest">
            Robot intake is available across
            <strong>{{ manifest.supported_source_channels.length }}</strong> source channel<span
              v-if="manifest.supported_source_channels.length !== 1"
              >s</span
            >. New jobs appear automatically in the UiPath Jobs workspace.
          </p>
        </article>
      </div>
    </PanelCard>
  </div>
</template>
