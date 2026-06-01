<script setup>
import { computed, ref } from "vue";

import { uploadService } from "@/services/uploadService";
import { formatFileType, formatSourceType } from "@/utils/formatEnums";

const props = defineProps({
  attachments: {
    type: Array,
    default: () => []
  },
  emptyMessage: {
    type: String,
    default: "No attachments available."
  },
  selectable: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(["update:modelValue"]);

const attachmentError = ref("");
const activeAttachmentId = ref("");

const selectedIds = computed({
  get() {
    return props.modelValue;
  },
  set(value) {
    emit("update:modelValue", value);
  }
});

function formatDate(value) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canPreview(attachment) {
  return ["application/pdf", "image/jpeg", "image/png", "text/plain"].includes(attachment.file_type);
}

function toggleSelection(attachmentId, checked) {
  const current = new Set(selectedIds.value);

  if (checked) {
    current.add(attachmentId);
  } else {
    current.delete(attachmentId);
  }

  selectedIds.value = [...current];
}

async function withAttachmentBlob(attachment, callback) {
  activeAttachmentId.value = attachment.id;
  attachmentError.value = "";

  try {
    const blob = await uploadService.fetchAttachmentBlob(attachment.id);
    const objectUrl = URL.createObjectURL(blob);

    callback(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    attachmentError.value = error.response?.data?.message ?? "Attachment could not be opened.";
  } finally {
    activeAttachmentId.value = "";
  }
}

async function previewAttachment(attachment) {
  await withAttachmentBlob(attachment, (objectUrl) => {
    window.open(objectUrl, "_blank", "noopener,noreferrer");
  });
}

async function downloadAttachment(attachment) {
  await withAttachmentBlob(attachment, (objectUrl) => {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = attachment.file_name;
    link.click();
  });
}
</script>

<template>
  <div class="attachment-stack">
    <p v-if="attachmentError" class="form-error">{{ attachmentError }}</p>

    <ul v-if="attachments.length" class="attachment-records">
      <li v-for="attachment in attachments" :key="attachment.id" class="attachment-record">
        <div class="attachment-main">
          <label v-if="selectable" class="attachment-select">
            <input
              :checked="selectedIds.includes(attachment.id)"
              type="checkbox"
              @change="toggleSelection(attachment.id, $event.target.checked)"
            />
            <span>Select</span>
          </label>

          <div>
            <strong>{{ attachment.file_name }}</strong>
            <div class="attachment-meta-line">
              <span>{{ formatFileType(attachment.file_type) }}</span>
              <span>{{ formatSize(attachment.size_bytes) }}</span>
              <span>{{ formatSourceType(attachment.source_type) }}</span>
            </div>
            <div class="attachment-meta-line">
              <span>Uploaded {{ formatDate(attachment.uploaded_at) }}</span>
              <span v-if="attachment.source_label">{{ attachment.source_label }}</span>
            </div>
            <p v-if="attachment.notes" class="attachment-note">{{ attachment.notes }}</p>
          </div>
        </div>

        <div class="attachment-actions">
          <button
            class="secondary-button"
            type="button"
            :disabled="activeAttachmentId === attachment.id || !canPreview(attachment)"
            @click="previewAttachment(attachment)"
          >
            {{ activeAttachmentId === attachment.id ? "Opening..." : "Preview" }}
          </button>
          <button
            class="secondary-button"
            type="button"
            :disabled="activeAttachmentId === attachment.id"
            @click="downloadAttachment(attachment)"
          >
            Download
          </button>
        </div>
      </li>
    </ul>

    <div v-else class="empty-inline">{{ emptyMessage }}</div>
  </div>
</template>
