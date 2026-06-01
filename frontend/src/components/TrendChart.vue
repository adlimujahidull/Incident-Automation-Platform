<script setup>
import { computed } from "vue";

const props = defineProps({
  series: {
    type: Array,
    default: () => []
  }
});

const width = 640;
const height = 220;
const paddingX = 36;
const paddingY = 28;

const maxValue = computed(() => {
  const values = props.series.flatMap((entry) => [entry.created ?? 0, entry.resolved ?? 0]);
  const max = values.length ? Math.max(...values) : 0;
  return max > 0 ? max : 4;
});

const xStep = computed(() => {
  if (props.series.length <= 1) {
    return 0;
  }

  return (width - paddingX * 2) / (props.series.length - 1);
});

function pointFor(value, index) {
  const x = paddingX + index * xStep.value;
  const y = paddingY + (1 - value / maxValue.value) * (height - paddingY * 2);
  return { x, y };
}

const createdPath = computed(() => {
  if (!props.series.length) {
    return "";
  }

  return props.series
    .map((entry, index) => {
      const { x, y } = pointFor(entry.created ?? 0, index);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
});

const resolvedPath = computed(() => {
  if (!props.series.length) {
    return "";
  }

  return props.series
    .map((entry, index) => {
      const { x, y } = pointFor(entry.resolved ?? 0, index);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
});

const tickLabels = computed(() => {
  if (!props.series.length) {
    return [];
  }

  const formatter = new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short" });
  return props.series.map((entry, index) => {
    const { x } = pointFor(0, index);
    return {
      label: formatter.format(new Date(entry.date)),
      x
    };
  });
});

const visibleTicks = computed(() => {
  if (!tickLabels.value.length) {
    return [];
  }

  const lastIndex = tickLabels.value.length - 1;
  const stride = Math.max(1, Math.floor(tickLabels.value.length / 6));
  return tickLabels.value.filter((_, index) => index === 0 || index === lastIndex || index % stride === 0);
});

const yAxisTicks = computed(() => {
  const max = maxValue.value;
  const steps = 4;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const value = Math.round((max * (steps - index)) / steps);
    const y = paddingY + (index * (height - paddingY * 2)) / steps;
    return { value, y };
  });
});

const totals = computed(() => {
  const created = props.series.reduce((sum, entry) => sum + (entry.created ?? 0), 0);
  const resolved = props.series.reduce((sum, entry) => sum + (entry.resolved ?? 0), 0);
  return { created, resolved };
});
</script>

<template>
  <div class="trend-chart">
    <div class="trend-legend">
      <span class="legend-item">
        <span class="legend-dot is-created" />
        Created
        <strong>{{ totals.created }}</strong>
      </span>
      <span class="legend-item">
        <span class="legend-dot is-resolved" />
        Resolved
        <strong>{{ totals.resolved }}</strong>
      </span>
    </div>

    <svg :viewBox="`0 0 ${width} ${height}`" class="trend-svg" preserveAspectRatio="xMidYMid meet">
      <g class="trend-grid">
        <line
          v-for="tick in yAxisTicks"
          :key="tick.y"
          :x1="paddingX"
          :x2="width - paddingX"
          :y1="tick.y"
          :y2="tick.y"
        />
      </g>

      <g class="trend-axis-labels">
        <text v-for="tick in yAxisTicks" :key="`y-${tick.y}`" :x="paddingX - 8" :y="tick.y + 4" text-anchor="end">
          {{ tick.value }}
        </text>
        <text v-for="tick in visibleTicks" :key="`x-${tick.x}`" :x="tick.x" :y="height - 6" text-anchor="middle">
          {{ tick.label }}
        </text>
      </g>

      <path :d="createdPath" class="trend-line is-created" />
      <path :d="resolvedPath" class="trend-line is-resolved" />
    </svg>
  </div>
</template>
