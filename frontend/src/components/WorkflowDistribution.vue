<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

import { formatStatus } from "@/utils/formatEnums";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  }
});

const total = computed(() => props.items.reduce((sum, item) => sum + (item.count ?? 0), 0));

function statusClass(status) {
  if (["RESOLVED", "CLOSED"].includes(status)) {
    return "status-pill is-success";
  }

  if (["REJECTED", "FAILED", "DUPLICATE"].includes(status)) {
    return "status-pill is-warning";
  }

  if (status === "IN REVIEW" || status === "IN_REVIEW") {
    return "status-pill is-review";
  }

  if (status === "ASSIGNED") {
    return "status-pill is-assigned";
  }

  return "status-pill is-active";
}

function widthFor(count) {
  if (!total.value) {
    return "0%";
  }

  return `${Math.max(2, Math.round((count / total.value) * 100))}%`;
}
</script>

<template>
  <ul class="workflow-list">
    <li v-for="item in items" :key="item.status" class="workflow-row workflow-row-bar">
      <RouterLink :to="{ path: '/incidents', query: { status: item.status } }" class="workflow-link">
        <span :class="statusClass(item.status)">{{ formatStatus(item.status) }}</span>
      </RouterLink>
      <div class="bar-track">
        <div class="bar-fill" :style="{ width: widthFor(item.count) }" />
      </div>
      <strong>{{ item.count }}</strong>
    </li>
  </ul>
</template>
