<script setup>
import { computed } from "vue";

const props = defineProps({
  page: {
    type: Number,
    required: true
  },
  pageSize: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  pageCount: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(["update:page", "update:pageSize"]);

const rangeStart = computed(() => {
  if (props.total === 0) {
    return 0;
  }

  return (props.page - 1) * props.pageSize + 1;
});

const rangeEnd = computed(() => Math.min(props.page * props.pageSize, props.total));

const canGoPrevious = computed(() => props.page > 1);
const canGoNext = computed(() => props.page < props.pageCount);

function changePage(next) {
  if (next < 1 || next > props.pageCount) {
    return;
  }

  emit("update:page", next);
}

function changePageSize(event) {
  const next = Number(event.target.value);

  if (Number.isFinite(next) && next > 0) {
    emit("update:pageSize", next);
  }
}
</script>

<template>
  <div class="pagination-bar">
    <div class="pagination-meta">
      <span v-if="total">{{ rangeStart }}–{{ rangeEnd }} of {{ total }}</span>
      <span v-else>No results</span>
    </div>

    <div class="pagination-controls">
      <label class="pagination-size">
        <span>Rows</span>
        <select :value="pageSize" @change="changePageSize">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </label>

      <div class="pagination-nav">
        <button
          type="button"
          class="secondary-button"
          :disabled="!canGoPrevious"
          @click="changePage(page - 1)"
        >
          Previous
        </button>
        <span class="pagination-page">Page {{ page }} / {{ pageCount }}</span>
        <button
          type="button"
          class="secondary-button"
          :disabled="!canGoNext"
          @click="changePage(page + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
