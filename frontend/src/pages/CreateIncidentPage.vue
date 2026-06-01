<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import AttachmentEvidenceList from "@/components/AttachmentEvidenceList.vue";
import PanelCard from "@/components/PanelCard.vue";
import { incidentService } from "@/services/incidentService";
import { metaService } from "@/services/metaService";
import { uploadService } from "@/services/uploadService";
import { formatSourceType } from "@/utils/formatEnums";

const router = useRouter();

const step = ref(1);
const loading = ref(true);
const uploadBusy = ref(false);
const submitBusy = ref(false);
const stagedAttachments = ref([]);
const selectedAttachmentIds = ref([]);
const metaOptions = ref({
  categories: [],
  priorities: [],
  departments: [],
  source_types: []
});

const uploadError = ref("");
const uploadMessage = ref("");
const submitError = ref("");
const extractBusy = ref(false);
const extractError = ref("");
const extractionPreview = ref(null);
const showExtractionModal = ref(false);

const selectedFile = ref(null);

const uploadForm = reactive({
  source_type: "MANUAL_UPLOAD",
  source_label: "",
  notes: ""
});

const incidentForm = reactive({
  title: "",
  summary: "",
  category: "",
  priority: "",
  source_type: "MANUAL_UPLOAD",
  assigned_department: "",
  tags: "",
  suggested_action: ""
});

const selectedAttachmentCount = computed(() => selectedAttachmentIds.value.length);
const canProceedToReview = computed(() => selectedAttachmentIds.value.length > 0);

function isExtractableExtension(extension) {
  return [".pdf", ".docx", ".txt"].includes(String(extension ?? "").toLowerCase());
}

const extractableSelection = computed(() => {
  if (!selectedAttachmentIds.value.length) {
    return null;
  }

  const lookup = new Map(stagedAttachments.value.map((item) => [item.id, item]));
  return selectedAttachmentIds.value
    .map((id) => lookup.get(id))
    .find((entry) => entry && isExtractableExtension(entry.file_extension));
});

function resetUploadMessages() {
  uploadError.value = "";
  uploadMessage.value = "";
}

function resetSubmitMessages() {
  submitError.value = "";
}

function handleFileSelection(event) {
  selectedFile.value = event.target.files?.[0] ?? null;
}

async function loadReferenceData() {
  const [options, staged] = await Promise.all([metaService.getIncidentOptions(), uploadService.listStaged()]);
  metaOptions.value = options;
  stagedAttachments.value = staged;

  if (!incidentForm.category && options.categories.length) {
    incidentForm.category = options.categories[0];
  }

  if (!incidentForm.priority && options.priorities.length) {
    incidentForm.priority = options.priorities[1] ?? options.priorities[0];
  }

  if (!incidentForm.assigned_department && options.departments.length) {
    incidentForm.assigned_department = options.departments[0];
  }

  if (!incidentForm.source_type && options.source_types.length) {
    incidentForm.source_type = options.source_types[0];
  }
}

async function refreshStagedAttachments() {
  stagedAttachments.value = await uploadService.listStaged();
  const availableIds = new Set(stagedAttachments.value.map((attachment) => attachment.id));
  selectedAttachmentIds.value = selectedAttachmentIds.value.filter((attachmentId) => availableIds.has(attachmentId));
}

async function submitUpload() {
  if (!selectedFile.value) {
    uploadError.value = "Choose a file before staging evidence.";
    return;
  }

  uploadBusy.value = true;
  resetUploadMessages();

  try {
    const result = await uploadService.uploadEvidence({
      file: selectedFile.value,
      source_type: uploadForm.source_type,
      source_label: uploadForm.source_label || undefined,
      notes: uploadForm.notes || undefined
    });

    await refreshStagedAttachments();
    selectedAttachmentIds.value = [...new Set([result.attachment.id, ...selectedAttachmentIds.value])];
    uploadMessage.value = "Evidence staged. Upload more files or continue to the next step.";
    uploadForm.source_label = "";
    uploadForm.notes = "";
    selectedFile.value = null;
    const fileInput = document.getElementById("evidence-file-input");

    if (fileInput instanceof HTMLInputElement) {
      fileInput.value = "";
    }
  } catch (error) {
    uploadError.value = error.response?.data?.message ?? "Evidence file could not be staged.";
  } finally {
    uploadBusy.value = false;
  }
}

function proceedToReview() {
  if (!canProceedToReview.value) {
    uploadError.value = "Tick at least one staged file before continuing.";
    return;
  }

  resetUploadMessages();
  step.value = 2;
}

function backToStage() {
  resetSubmitMessages();
  step.value = 1;
}

async function runExtraction() {
  const target = extractableSelection.value;

  if (!target) {
    extractError.value = "Select a staged PDF, DOCX, or TXT file before running auto-fill.";
    showExtractionModal.value = true;
    return;
  }

  extractBusy.value = true;
  extractError.value = "";
  extractionPreview.value = null;
  showExtractionModal.value = true;

  try {
    extractionPreview.value = await uploadService.extractAttachment(target.id);
  } catch (error) {
    extractError.value = error.response?.data?.message ?? "Auto-fill could not be completed.";
  } finally {
    extractBusy.value = false;
  }
}

function applyExtractionDraft() {
  const draft = extractionPreview.value?.draft ?? {};

  incidentForm.title = draft.title ?? incidentForm.title;
  incidentForm.summary = draft.summary ?? incidentForm.summary;
  incidentForm.category = draft.category ?? incidentForm.category;
  incidentForm.priority = draft.priority ?? incidentForm.priority;
  incidentForm.assigned_department = draft.assigned_department ?? incidentForm.assigned_department;
  incidentForm.suggested_action = draft.suggested_action ?? incidentForm.suggested_action;

  if (Array.isArray(draft.tags) && draft.tags.length) {
    incidentForm.tags = draft.tags.join(", ");
  }

  closeExtractionModal();
}

function closeExtractionModal() {
  showExtractionModal.value = false;
  extractError.value = "";
}

async function submitIncident() {
  submitBusy.value = true;
  resetSubmitMessages();

  try {
    const incident = await incidentService.create({
      title: incidentForm.title,
      summary: incidentForm.summary,
      category: incidentForm.category,
      priority: incidentForm.priority,
      source_type: incidentForm.source_type,
      assigned_department: incidentForm.assigned_department,
      tags: incidentForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      suggested_action: incidentForm.suggested_action || undefined,
      attachment_ids: selectedAttachmentIds.value
    });

    await router.push(`/incidents/${incident.id}`);
  } catch (error) {
    submitError.value = error.response?.data?.message ?? "Incident draft could not be created.";
  } finally {
    submitBusy.value = false;
  }
}

onMounted(async () => {
  try {
    await loadReferenceData();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page-grid">
    <PanelCard
      title="Incident Intake Workspace"
      :description="
        step === 1
          ? 'Step 1 of 2 — stage the raw evidence files that support this incident.'
          : 'Step 2 of 2 — review the draft, optionally auto-fill from the evidence, then create the incident.'
      "
    >
      <template #actions>
        <RouterLink class="secondary-button" to="/incidents">Back to Register</RouterLink>
      </template>

      <div v-if="loading" class="empty-inline">Loading intake workspace...</div>

      <template v-else>
        <ol class="wizard-steps">
          <li :class="{ 'is-active': step === 1, 'is-done': step > 1 }">
            <span class="wizard-step-num">1</span>
            <div>
              <strong>Stage Evidence</strong>
              <small>Upload PDF, DOCX, TXT, or image files and tick the ones to attach.</small>
            </div>
          </li>
          <li :class="{ 'is-active': step === 2 }">
            <span class="wizard-step-num">2</span>
            <div>
              <strong>Review &amp; Submit</strong>
              <small>Auto-fill from the evidence, edit if needed, then create the incident.</small>
            </div>
          </li>
        </ol>

        <div v-if="step === 1" class="page-grid">
          <PanelCard title="Upload Raw Evidence" description="Accepted formats: PDF, DOCX, PNG, JPG, JPEG, and TXT.">
            <div class="form-stack">
              <p v-if="uploadMessage" class="form-success">{{ uploadMessage }}</p>
              <p v-if="uploadError" class="form-error">{{ uploadError }}</p>

              <label class="dropzone-field" for="evidence-file-input">
                <span>Raw File</span>
                <input
                  id="evidence-file-input"
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
                  @change="handleFileSelection"
                />
                <strong>{{ selectedFile?.name ?? "Select operational evidence to stage" }}</strong>
                <small>Files are stored privately and must be linked through authenticated workflow actions.</small>
              </label>

              <div class="form-grid-two">
                <label>
                  <span>Source Type</span>
                  <select v-model="uploadForm.source_type">
                    <option v-for="sourceType in metaOptions.source_types" :key="sourceType" :value="sourceType">
                      {{ formatSourceType(sourceType) }}
                    </option>
                  </select>
                </label>

                <label>
                  <span>Where it came from</span>
                  <input
                    v-model="uploadForm.source_label"
                    type="text"
                    placeholder="e.g. Warehouse desk, customer email, Telegram export"
                  />
                </label>
              </div>

              <label>
                <span>Note for the reviewer</span>
                <textarea
                  v-model="uploadForm.notes"
                  rows="3"
                  placeholder="Capture why this file matters before it enters the incident workflow."
                />
              </label>

              <button class="primary-button" type="button" :disabled="uploadBusy" @click="submitUpload">
                {{ uploadBusy ? "Staging..." : "Stage Evidence" }}
              </button>
            </div>
          </PanelCard>

          <PanelCard
            title="Staged Evidence Queue"
            :description="`${stagedAttachments.length} file(s) staged. Tick the ones to attach to this incident.`"
          >
            <AttachmentEvidenceList
              v-model="selectedAttachmentIds"
              :attachments="stagedAttachments"
              empty-message="No staged evidence yet. Upload raw files first."
              selectable
            />
          </PanelCard>

          <div class="wizard-actions">
            <small v-if="!canProceedToReview" class="empty-inline" style="padding: 0;">
              Tick at least one staged file before continuing.
            </small>
            <button class="primary-button" type="button" :disabled="!canProceedToReview" @click="proceedToReview">
              Continue to Review &amp; Submit →
            </button>
          </div>
        </div>

        <div v-else class="page-grid">
          <PanelCard
            title="Structured Incident Draft"
            :description="`${selectedAttachmentCount} staged file(s) selected. Use auto-fill or write the draft manually.`"
          >
            <template #actions>
              <button class="secondary-button" type="button" @click="backToStage">← Back to Step 1</button>
            </template>

            <form class="form-stack" @submit.prevent="submitIncident">
              <p v-if="submitError" class="form-error">{{ submitError }}</p>

              <div class="autofill-banner">
                <div class="autofill-banner-text">
                  <strong>Auto-fill from selected evidence</strong>
                  <small v-if="extractableSelection">
                    Source: {{ extractableSelection.file_name }} ({{ extractableSelection.file_extension }})
                  </small>
                  <small v-else>
                    Tick a staged PDF, DOCX, or TXT file in Step 1 to unlock auto-fill.
                  </small>
                </div>
                <button
                  class="secondary-button"
                  type="button"
                  :disabled="extractBusy || !extractableSelection"
                  @click="runExtraction"
                >
                  {{ extractBusy ? "Extracting..." : "Auto-fill Draft" }}
                </button>
              </div>

              <label>
                <span>Incident Title</span>
                <input
                  v-model="incidentForm.title"
                  type="text"
                  placeholder="Clear operational title for the intake case"
                  required
                />
              </label>

              <label>
                <span>Incident Summary</span>
                <textarea
                  v-model="incidentForm.summary"
                  rows="8"
                  placeholder="Summarize the operational issue, impact, and current evidence."
                  required
                />
              </label>

              <div class="form-grid-two">
                <label>
                  <span>Category</span>
                  <select v-model="incidentForm.category" required>
                    <option v-for="category in metaOptions.categories" :key="category" :value="category">
                      {{ category }}
                    </option>
                  </select>
                </label>

                <label>
                  <span>Priority</span>
                  <select v-model="incidentForm.priority" required>
                    <option v-for="priority in metaOptions.priorities" :key="priority" :value="priority">
                      {{ priority }}
                    </option>
                  </select>
                </label>
              </div>

              <div class="form-grid-two">
                <label>
                  <span>Source Type</span>
                  <select v-model="incidentForm.source_type" required>
                    <option v-for="sourceType in metaOptions.source_types" :key="sourceType" :value="sourceType">
                      {{ formatSourceType(sourceType) }}
                    </option>
                  </select>
                </label>

                <label>
                  <span>Assigned Department</span>
                  <select v-model="incidentForm.assigned_department" required>
                    <option v-for="department in metaOptions.departments" :key="department" :value="department">
                      {{ department }}
                    </option>
                  </select>
                </label>
              </div>

              <label>
                <span>Tags</span>
                <input v-model="incidentForm.tags" type="text" placeholder="damage, compensation, warehouse" />
              </label>

              <label>
                <span>Suggested Action</span>
                <textarea
                  v-model="incidentForm.suggested_action"
                  rows="4"
                  placeholder="Optional recommended next step for reviewer handoff."
                />
              </label>

              <button class="primary-button" type="submit" :disabled="submitBusy">
                {{ submitBusy ? "Creating..." : "Create Incident From Selected Evidence" }}
              </button>
            </form>
          </PanelCard>
        </div>
      </template>
    </PanelCard>

    <div v-if="showExtractionModal" class="modal-overlay" @click.self="closeExtractionModal">
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="extract-modal-title">
        <header class="modal-header">
          <div>
            <h2 id="extract-modal-title">Auto-fill Preview</h2>
            <p>Review the extracted draft before applying it to the form.</p>
          </div>
          <button class="modal-close" type="button" aria-label="Close" @click="closeExtractionModal">×</button>
        </header>

        <div class="modal-body">
          <div v-if="extractBusy" class="empty-inline">Extracting and analyzing content...</div>

          <template v-else>
            <p v-if="extractError" class="form-error">{{ extractError }}</p>

            <template v-if="extractionPreview">
              <section class="modal-section">
                <h3>Suggested Draft</h3>
                <dl class="modal-meta">
                  <div><dt>Title</dt><dd>{{ extractionPreview.draft?.title || "—" }}</dd></div>
                  <div><dt>Category</dt><dd>{{ extractionPreview.draft?.category || "—" }}</dd></div>
                  <div><dt>Priority</dt><dd>{{ extractionPreview.draft?.priority || "—" }}</dd></div>
                  <div><dt>Department</dt><dd>{{ extractionPreview.draft?.assigned_department || "—" }}</dd></div>
                  <div class="modal-meta-full"><dt>Summary</dt><dd>{{ extractionPreview.draft?.summary || "—" }}</dd></div>
                  <div class="modal-meta-full">
                    <dt>Tags</dt>
                    <dd>
                      <span v-if="extractionPreview.draft?.tags?.length">
                        {{ extractionPreview.draft.tags.join(", ") }}
                      </span>
                      <span v-else>—</span>
                    </dd>
                  </div>
                  <div class="modal-meta-full">
                    <dt>Suggested Action</dt>
                    <dd>{{ extractionPreview.draft?.suggested_action || "—" }}</dd>
                  </div>
                </dl>
              </section>

              <section class="modal-section">
                <h3>Extracted Text ({{ extractionPreview.character_count }} chars)</h3>
                <pre class="modal-pre">{{ extractionPreview.extracted_text }}</pre>
              </section>
            </template>
          </template>
        </div>

        <footer class="modal-footer">
          <button class="secondary-button" type="button" @click="closeExtractionModal">Discard</button>
          <button
            class="primary-button"
            type="button"
            :disabled="extractBusy || !extractionPreview"
            @click="applyExtractionDraft"
          >
            Apply to Form
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>
