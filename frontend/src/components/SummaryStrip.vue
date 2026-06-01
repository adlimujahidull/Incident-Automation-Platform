<script setup>
import { RouterLink } from "vue-router";

defineProps({
  items: {
    type: Array,
    default: () => []
  },
  className: {
    type: String,
    default: ""
  }
});
</script>

<template>
  <section class="summary-strip" :class="className">
    <template v-for="item in items" :key="item.key">
      <RouterLink
        v-if="item.to"
        class="summary-cell summary-cell-link"
        :to="item.to"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small v-if="item.hint">{{ item.hint }}</small>
      </RouterLink>
      <article v-else class="summary-cell">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small v-if="item.hint">{{ item.hint }}</small>
      </article>
    </template>
  </section>
</template>
