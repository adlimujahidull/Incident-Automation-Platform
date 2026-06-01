<script setup>
import { computed, ref } from "vue";

import { formatRole } from "@/utils/formatRole";
import { formatSourceType, formatStatus } from "@/utils/formatEnums";

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  options: {
    type: Object,
    required: true
  },
  assignees: {
    type: Array,
    default: () => []
  },
  busy: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["update:modelValue", "apply", "reset"]);

const filters = computed(() => props.modelValue);
const tagDraft = ref("");

function toggleArrayValue(field, value) {
  const current = Array.isArray(filters.value[field]) ? filters.value[field] : [];
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  emit("update:modelValue", { ...filters.value, [field]: next });
}

function setField(field, value) {
  emit("update:modelValue", { ...filters.value, [field]: value });
}

function isSelected(field, value) {
  return Array.isArray(filters.value[field]) && filters.value[field].includes(value);
}

function addTag() {
  const trimmed = tagDraft.value.trim().toLowerCase();
  if (!trimmed) {
    return;
  }

  const current = Array.isArray(filters.value.tags) ? filters.value.tags : [];
  if (current.includes(trimmed)) {
    tagDraft.value = "";
    return;
  }

  if (current.length >= 8) {
    return;
  }

  emit("update:modelValue", { ...filters.value, tags: [...current, trimmed] });
  tagDraft.value = "";
}

function removeTag(tag) {
  const current = Array.isArray(filters.value.tags) ? filters.value.tags : [];
  emit("update:modelValue", { ...filters.value, tags: current.filter((item) => item !== tag) });
}

function handleSubmit() {
  emit("apply");
}

function handleReset() {
  tagDraft.value = "";
  emit("reset");
}
</script>

<template>
  <form class="fbar" @submit.prevent="handleSubmit">
    <div class="fbar-row">
      <input
        type="text"
        class="fbar-search"
        placeholder="Title, summary, code, or source"
        :value="filters.query"
        @input="setField('query', $event.target.value)"
      />
      <input
        type="date"
        class="fbar-date"
        :value="filters.from"
        @input="setField('from', $event.target.value)"
      />
      <input
        type="date"
        class="fbar-date"
        :value="filters.to"
        @input="setField('to', $event.target.value)"
      />
      <select
        class="fbar-field"
        :value="filters.assignee"
        @change="setField('assignee', $event.target.value)"
      >
        <option value="">All assignees</option>
        <option value="unassigned">Unassigned</option>
        <option v-for="user in assignees" :key="user.id" :value="user.id">
          {{ user.name }} — {{ formatRole(user.role) }}
        </option>
      </select>
      <input
        type="text"
        class="fbar-field"
        placeholder="Creator (name or email)"
        :value="filters.creator"
        @input="setField('creator', $event.target.value)"
      />
      <div class="fbar-actions">
        <button class="primary-button" type="submit" :disabled="busy">
          {{ busy ? "Applying..." : "Apply Filters" }}
        </button>
        <button class="secondary-button" type="button" @click="handleReset">Reset</button>
      </div>
    </div>

    <div class="fbar-chips">
      <span class="fbar-chips-label">Status</span>
      <button
        v-for="status in options.statuses"
        :key="status"
        type="button"
        class="chip-toggle"
        :class="{ 'is-active': isSelected('status', status) }"
        @click="toggleArrayValue('status', status)"
      >
        {{ formatStatus(status) }}
      </button>
    </div>

    <div class="fbar-chips-row">
      <div class="fbar-chips">
        <span class="fbar-chips-label">Priority</span>
        <button
          v-for="priority in options.priorities"
          :key="priority"
          type="button"
          class="chip-toggle"
          :class="{ 'is-active': isSelected('priority', priority) }"
          @click="toggleArrayValue('priority', priority)"
        >
          {{ priority }}
        </button>
      </div>

      <div class="fbar-chips">
        <span class="fbar-chips-label">Department</span>
        <button
          v-for="department in options.departments"
          :key="department"
          type="button"
          class="chip-toggle"
          :class="{ 'is-active': isSelected('department', department) }"
          @click="toggleArrayValue('department', department)"
        >
          {{ department }}
        </button>
      </div>
    </div>

    <div class="fbar-chips">
      <span class="fbar-chips-label">Tags</span>
      <span
        v-for="tag in filters.tags"
        :key="tag"
        class="chip-toggle is-active"
      >
        {{ tag }}
        <button type="button" class="chip-remove" aria-label="Remove tag" @click="removeTag(tag)">
          ×
        </button>
      </span>
      <input
        type="text"
        class="fbar-tag-input"
        placeholder="Add tag and press Enter"
        :value="tagDraft"
        @input="tagDraft = $event.target.value"
        @keydown.enter.prevent="addTag"
      />
    </div>

    <div class="fbar-chips-row">
      <div class="fbar-chips">
        <span class="fbar-chips-label">Category</span>
        <button
          v-for="category in options.categories"
          :key="category"
          type="button"
          class="chip-toggle"
          :class="{ 'is-active': isSelected('category', category) }"
          @click="toggleArrayValue('category', category)"
        >
          {{ category }}
        </button>
      </div>

      <div class="fbar-chips">
        <span class="fbar-chips-label">Source</span>
        <button
          v-for="source in options.source_types"
          :key="source"
          type="button"
          class="chip-toggle"
          :class="{ 'is-active': isSelected('source_type', source) }"
          @click="toggleArrayValue('source_type', source)"
        >
          {{ formatSourceType(source) }}
        </button>
      </div>
    </div>
  </form>
</template>
