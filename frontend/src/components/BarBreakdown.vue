<script setup>
import { computed } from "vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  labelKey: {
    type: String,
    required: true
  },
  valueKey: {
    type: String,
    default: "count"
  },
  emptyMessage: {
    type: String,
    default: "No data captured for this period yet."
  },
  labelFormatter: {
    type: Function,
    default: null
  }
});

const maxValue = computed(() => {
  const numbers = props.items.map((item) => Number(item[props.valueKey] ?? 0));
  const max = numbers.length ? Math.max(...numbers) : 0;
  return max > 0 ? max : 1;
});

function widthFor(item) {
  const value = Number(item[props.valueKey] ?? 0);
  return `${Math.max(2, Math.round((value / maxValue.value) * 100))}%`;
}

function valueFor(item) {
  return Number(item[props.valueKey] ?? 0);
}

function labelFor(item) {
  const raw = item[props.labelKey];
  if (props.labelFormatter) {
    return props.labelFormatter(raw) || raw || "—";
  }
  return raw ?? "—";
}
</script>

<template>
  <ul v-if="items.length" class="bar-breakdown">
    <li v-for="item in items" :key="labelFor(item)" class="bar-row">
      <div class="bar-label">
        <span class="bar-label-text">{{ labelFor(item) }}</span>
        <span class="bar-value">{{ valueFor(item) }}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" :style="{ width: widthFor(item) }" />
      </div>
    </li>
  </ul>
  <div v-else class="empty-inline">{{ emptyMessage }}</div>
</template>
