<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";

import ActivityList from "@/components/ActivityList.vue";
import AttachmentEvidenceList from "@/components/AttachmentEvidenceList.vue";
import PanelCard from "@/components/PanelCard.vue";
import { incidentService } from "@/services/incidentService";
import { metaService } from "@/services/metaService";
import { uploadService } from "@/services/uploadService";
import { useSessionStore } from "@/stores/session";
import { hasPermission } from "@/utils/authorization";
import { formatRole } from "@/utils/formatRole";
import {
  filterUserVisibleTags,
  formatActor,
  formatProvider,
  formatSourceType,
  formatStatus
} from "@/utils/formatEnums";

const route = useRoute();
const sessionStore = useSessionStore();
const loading = ref(true);
const incident = ref(null);
const assignees = ref([]);
const metaOptions = ref({
  source_types: []
});
const actionLoading = ref(false);
const actionError = ref("");
const actionMessage = ref("");
const selectedAttachmentFile = ref(null);
const activeTab = ref("overview");

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "workflow", label: "Workflow" },
  { id: "evidence", label: "Evidence" },
  { id: "ai", label: "AI Triage" },
  { id: "activity", label: "Activity" }
];

const assignmentForm = reactive({
  assigned_to_user_id: "",
  assigned_department: "",
  comment: ""
});

const statusForm = reactive({
  status: "",
  comment: "",
  duplicate_of_incident_code: ""
});

const commentForm = reactive({
  body: ""
});

const attachmentForm = reactive({
  source_type: "MANUAL_UPLOAD",
  source_label: "",
  notes: ""
});

const canAssign = computed(() => hasPermission(sessionStore.user, "assign_incidents"));
const canTransition = computed(() => hasPermission(sessionStore.user, "transition_incidents"));
const canComment = computed(() => hasPermission(sessionStore.user, "comment_incidents"));
const canUpload = computed(() => hasPermission(sessionStore.user, "upload_attachments"));
const canRunAi = computed(() => hasPermission(sessionStore.user, "run_ai_analysis"));
const canApplyAi = computed(() => hasPermission(sessionStore.user, "apply_ai_suggestions"));
const canArchive = computed(() => hasPermission(sessionStore.user, "delete_incidents"));
const archiveReason = ref("");
const isAlreadyArchived = computed(
  () =>
    incident.value?.status === "REJECTED" &&
    Array.isArray(incident.value?.tags) &&
    incident.value.tags.includes("archived")
);
const availableTransitions = computed(() => incident.value?.available_transitions ?? []);
const latestAiAnalysis = computed(() => incident.value?.ai_analyses?.[0] ?? null);
const aiSelection = ref([]);

const statusTone = computed(() => {
  const status = incident.value?.status;
  if (!status) return "is-active";
  if (["RESOLVED", "CLOSED"].includes(status)) return "is-success";
  if (["FAILED", "REJECTED", "DUPLICATE"].includes(status)) return "is-warning";
  if (["IN_REVIEW", "ASSIGNED"].includes(status)) return "is-review";
  return "is-active";
});

const priorityTone = computed(() => {
  const priority = incident.value?.priority;
  if (priority === "Critical") return "is-warning";
  if (priority === "High") return "is-review";
  return "";
});

const summarySections = computed(() => {
  const raw = (incident.value?.summary ?? "").trim();
  if (!raw) return [];

  const normalized = raw.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();

  const labelRegex = /(?:^|[\n\s])([A-Z][A-Za-z]+(?:[ /&][A-Z][A-Za-z]+){0,3}):\s+/g;
  const matches = [...normalized.matchAll(labelRegex)];

  const buildBlock = (label, body) => {
    const text = body.trim();
    if (!text) return { type: "labeled", label, text: "", bullets: [] };

    const bulletRegex = /(?:^|\s)-\s+/g;
    const parts = text.split(bulletRegex).map((p) => p.trim()).filter(Boolean);

    if (parts.length > 1) {
      return { type: "labeled", label, text: parts[0], bullets: parts.slice(1) };
    }
    return { type: "labeled", label, text, bullets: [] };
  };

  const chunkParagraph = (paragraph) => {
    const text = paragraph.trim();
    if (!text) return [];
    const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [text];
    const groups = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const slice = sentences.slice(i, i + 2).join(" ").trim();
      if (slice) groups.push(slice);
    }
    return groups;
  };

  if (matches.length === 0) {
    return chunkParagraph(normalized).map((text) => ({ type: "paragraph", text }));
  }

  const sections = [];
  const firstStart = matches[0].index + (/^[\n\s]/.test(matches[0][0]) ? 1 : 0);
  if (firstStart > 0) {
    chunkParagraph(normalized.slice(0, firstStart)).forEach((text) => {
      sections.push({ type: "paragraph", text });
    });
  }

  matches.forEach((match, idx) => {
    const contentStart = match.index + match[0].length;
    const nextMatch = matches[idx + 1];
    const contentEnd = nextMatch
      ? nextMatch.index + (/^[\n\s]/.test(nextMatch[0]) ? 1 : 0)
      : normalized.length;
    const label = match[1].trim();
    const body = normalized.slice(contentStart, contentEnd);
    sections.push(buildBlock(label, body));
  });

  return sections;
});

const metadata = computed(() => {
  if (!incident.value) {
    return [];
  }

  return [
    { label: "Category", value: incident.value.category },
    { label: "Department", value: incident.value.assigned_department },
    { label: "Owner", value: incident.value.assigned_to?.name ?? "Unassigned" },
    { label: "Source", value: formatSourceType(incident.value.source_type) },
    { label: "Created by", value: formatActor(incident.value.created_by) },
    { label: "Created", value: incident.value.created_at ? formatDateTime(incident.value.created_at) : "—" }
  ];
});

const visibleTags = computed(() => filterUserVisibleTags(incident.value?.tags));

const aiFieldOptions = computed(() => {
  if (!incident.value || !latestAiAnalysis.value) {
    return [];
  }

  const analysis = latestAiAnalysis.value;
  const currentIncident = incident.value;

  return [
    { field: "title", label: "Title", current: currentIncident.title, suggested: analysis.title_suggestion },
    { field: "summary", label: "Summary", current: currentIncident.summary, suggested: analysis.summary_suggestion },
    { field: "category", label: "Category", current: currentIncident.category, suggested: analysis.category_suggestion },
    { field: "priority", label: "Priority", current: currentIncident.priority, suggested: analysis.priority_suggestion },
    {
      field: "assigned_department",
      label: "Department",
      current: currentIncident.assigned_department,
      suggested: analysis.department_suggestion
    },
    {
      field: "tags",
      label: "Tags",
      current: (currentIncident.tags ?? []).join(", "),
      suggested: (analysis.tags_suggestion ?? []).join(", ")
    },
    {
      field: "suggested_action",
      label: "Suggested Action",
      current: currentIncident.suggested_action ?? "Not set",
      suggested: analysis.suggested_action_suggestion
    }
  ]
    .filter((item) => item.suggested)
    .map((item) => ({
      ...item,
      changed: item.current !== item.suggested
    }));
});

function resetMessages() {
  actionError.value = "";
  actionMessage.value = "";
}

function syncForms() {
  if (!incident.value) {
    return;
  }

  assignmentForm.assigned_to_user_id = incident.value.assigned_to?.id ?? "";
  assignmentForm.assigned_department = incident.value.assigned_department ?? "";
  assignmentForm.comment = "";
  statusForm.status = availableTransitions.value[0] ?? "";
  statusForm.comment = "";
  statusForm.duplicate_of_incident_code = incident.value.duplicate_parent?.incident_code ?? "";
  attachmentForm.source_type = incident.value.source_type;
  attachmentForm.source_label = "";
  attachmentForm.notes = "";
  selectedAttachmentFile.value = null;
  aiSelection.value = aiFieldOptions.value.filter((item) => item.changed).map((item) => item.field);
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-MY");
}

async function loadIncident() {
  loading.value = true;

  try {
    incident.value = await incidentService.getById(route.params.id);
    syncForms();
  } finally {
    loading.value = false;
  }
}

async function loadAssignees() {
  if (!canAssign.value) {
    return;
  }

  assignees.value = await incidentService.listAssignees();
}

async function loadMetaOptions() {
  if (!canUpload.value) {
    return;
  }

  metaOptions.value = await metaService.getIncidentOptions();
}

async function runAction(task, successMessage) {
  actionLoading.value = true;
  resetMessages();

  try {
    incident.value = await task();
    syncForms();
    actionMessage.value = successMessage;
  } catch (error) {
    actionError.value = error.response?.data?.message ?? "Workflow action could not be completed.";
  } finally {
    actionLoading.value = false;
  }
}

function handleAttachmentSelection(event) {
  selectedAttachmentFile.value = event.target.files?.[0] ?? null;
}

async function submitAssignment() {
  await runAction(
    () =>
      incidentService.assign(route.params.id, {
        assigned_to_user_id: assignmentForm.assigned_to_user_id,
        assigned_department: assignmentForm.assigned_department || undefined,
        comment: assignmentForm.comment || undefined
      }),
    "Assignment updated."
  );
}

async function submitStatus() {
  await runAction(
    () =>
      incidentService.updateStatus(route.params.id, {
        status: statusForm.status,
        comment: statusForm.comment || undefined,
        duplicate_of_incident_code:
          statusForm.status === "DUPLICATE" ? statusForm.duplicate_of_incident_code : undefined
      }),
    "Workflow status updated."
  );
}

async function submitComment() {
  await runAction(
    () =>
      incidentService.addComment(route.params.id, {
        body: commentForm.body
      }),
    "Comment added to incident record."
  );

  commentForm.body = "";
}

async function submitAttachment() {
  if (!selectedAttachmentFile.value) {
    actionError.value = "Choose a file before linking new evidence.";
    return;
  }

  actionLoading.value = true;
  resetMessages();

  try {
    await uploadService.uploadEvidence({
      incident_id: route.params.id,
      file: selectedAttachmentFile.value,
      source_type: attachmentForm.source_type,
      source_label: attachmentForm.source_label || undefined,
      notes: attachmentForm.notes || undefined
    });

    await loadIncident();
    actionMessage.value = "Attachment linked to the incident evidence register.";
    const fileInput = document.getElementById("incident-evidence-input");

    if (fileInput instanceof HTMLInputElement) {
      fileInput.value = "";
    }
  } catch (error) {
    actionError.value = error.response?.data?.message ?? "Attachment could not be linked.";
  } finally {
    actionLoading.value = false;
  }
}

async function runAiAnalysis() {
  await runAction(() => incidentService.runAiAnalysis(route.params.id), "AI triage suggestions refreshed.");
}

async function applyAiSuggestions() {
  if (!latestAiAnalysis.value) {
    actionError.value = "Run AI analysis first before applying suggestions.";
    return;
  }

  if (!aiSelection.value.length) {
    actionError.value = "Select at least one AI suggestion to apply.";
    return;
  }

  await runAction(
    () =>
      incidentService.applyAiAnalysis(route.params.id, latestAiAnalysis.value.id, {
        fields: aiSelection.value
      }),
    "Selected AI suggestions applied to the incident."
  );
}

async function archiveIncident() {
  const trimmed = archiveReason.value.trim();
  if (trimmed.length < 4) {
    actionError.value = "Provide a short operational reason before archiving (min 4 characters).";
    return;
  }

  const confirmed = window.confirm(
    `Archive incident ${incident.value?.incident_code}? It will move to REJECTED with an audit trail and stay searchable.`
  );

  if (!confirmed) {
    return;
  }

  actionLoading.value = true;
  resetMessages();

  try {
    await incidentService.archive(route.params.id, { reason: trimmed });
    await loadIncident();
    actionMessage.value = `Incident archived. It is now in REJECTED with an audit entry recorded.`;
    archiveReason.value = "";
  } catch (error) {
    actionError.value = error.response?.data?.message ?? "Incident could not be archived.";
  } finally {
    actionLoading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadIncident(), loadAssignees(), loadMetaOptions()]);
});
</script>

<template>
  <div class="page-grid">
    <div v-if="loading" class="empty-inline">Loading incident...</div>

    <template v-else-if="incident">
      <section class="incident-hero">
        <div class="incident-hero-main">
          <div class="incident-hero-kicker">
            <span class="incident-hero-code">{{ incident.incident_code }}</span>
            <span class="status-pill" :class="statusTone">{{ formatStatus(incident.status) }}</span>
            <span class="status-pill" :class="priorityTone">{{ incident.priority }}</span>
          </div>
          <h1 class="incident-hero-title">{{ incident.title }}</h1>
          <div v-if="visibleTags.length" class="tag-row incident-hero-tags">
            <span v-for="tag in visibleTags" :key="tag" class="status-chip">{{ tag }}</span>
          </div>
        </div>
        <div class="incident-hero-actions">
          <RouterLink class="secondary-button" :to="`/incidents/${incident.id}/timeline`">
            Open Timeline
          </RouterLink>
        </div>
      </section>

      <nav class="detail-tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="detail-tab"
          :class="{ 'is-active': activeTab === tab.id }"
          :aria-selected="activeTab === tab.id"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <p v-if="actionMessage" class="form-success">{{ actionMessage }}</p>
      <p v-if="actionError" class="form-error">{{ actionError }}</p>

      <section v-show="activeTab === 'overview'" class="page-grid">
        <PanelCard title="Incident Summary" description="What happened and the relevant context for review.">
          <div v-if="summarySections.length" class="incident-summary">
            <template v-for="(section, index) in summarySections" :key="index">
              <p v-if="section.type === 'paragraph'" class="summary-paragraph">{{ section.text }}</p>
              <div v-else class="summary-section">
                <h4 class="summary-section-label">{{ section.label }}</h4>
                <p v-if="section.text" class="summary-section-text">{{ section.text }}</p>
                <ul v-if="section.bullets && section.bullets.length" class="summary-section-list">
                  <li v-for="(item, bIdx) in section.bullets" :key="bIdx">{{ item }}</li>
                </ul>
              </div>
            </template>
          </div>
          <p v-else class="empty-inline">No summary captured for this incident yet.</p>

          <div v-if="incident.duplicate_parent" class="detail-note" style="margin-top: 16px;">
            <strong>Duplicate of:</strong>
            <RouterLink :to="`/incidents/${incident.duplicate_parent.id}`">
              {{ incident.duplicate_parent.incident_code }} — {{ incident.duplicate_parent.title }}
            </RouterLink>
          </div>
        </PanelCard>

        <PanelCard title="Case Snapshot" description="Key operational facts for this incident.">
          <dl class="detail-list">
            <div v-for="item in metadata" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>

          <div v-if="incident.suggested_action" class="detail-note" style="margin-top: 16px;">
            <strong>Suggested action</strong>
            <span>{{ incident.suggested_action }}</span>
          </div>
        </PanelCard>
      </section>

      <section v-show="activeTab === 'workflow'" class="page-grid">
        <PanelCard
          v-if="canAssign || canTransition || canComment"
          title="Workflow Actions"
          description="Assignment, lifecycle transitions, and operational notes."
        >
          <div class="form-stack">
            <form v-if="canAssign" class="action-form" @submit.prevent="submitAssignment">
              <div class="section-label">Assignment</div>
              <div class="form-grid-two">
                <label>
                  <span>Assignee</span>
                  <select v-model="assignmentForm.assigned_to_user_id" required>
                    <option disabled value="">Select operational owner</option>
                    <option v-for="user in assignees" :key="user.id" :value="user.id">
                      {{ user.name }} · {{ formatRole(user.role) }}
                    </option>
                  </select>
                </label>

                <label>
                  <span>Department</span>
                  <input
                    v-model="assignmentForm.assigned_department"
                    type="text"
                    placeholder="Optional department override"
                  />
                </label>
              </div>

              <label>
                <span>Assignment Note</span>
                <textarea
                  v-model="assignmentForm.comment"
                  rows="3"
                  placeholder="Explain why the incident is being assigned."
                />
              </label>

              <button class="secondary-button" type="submit" :disabled="actionLoading">
                {{ actionLoading ? "Saving..." : "Update Assignment" }}
              </button>
            </form>

            <form
              v-if="canTransition && availableTransitions.length"
              class="action-form"
              @submit.prevent="submitStatus"
            >
              <div class="section-label">Status Transition</div>
              <div class="form-grid-two">
                <label>
                  <span>Next Status</span>
                  <select v-model="statusForm.status" required>
                    <option v-for="status in availableTransitions" :key="status" :value="status">
                      {{ formatStatus(status) }}
                    </option>
                  </select>
                </label>

                <label v-if="statusForm.status === 'DUPLICATE'">
                  <span>Duplicate Incident Code</span>
                  <input
                    v-model="statusForm.duplicate_of_incident_code"
                    type="text"
                    placeholder="INC-20260514-0001"
                    required
                  />
                </label>
              </div>

              <label>
                <span>Operational Note</span>
                <textarea
                  v-model="statusForm.comment"
                  rows="3"
                  placeholder="Required for failed or rejected transitions."
                />
              </label>

              <button class="primary-button" type="submit" :disabled="actionLoading">
                {{ actionLoading ? "Applying..." : "Apply Status Change" }}
              </button>
            </form>

            <form v-if="canComment" class="action-form" @submit.prevent="submitComment">
              <div class="section-label">Add Comment</div>
              <label>
                <span>Comment</span>
                <textarea
                  v-model="commentForm.body"
                  rows="4"
                  placeholder="Capture triage notes, review outcomes, or handoff context."
                  required
                />
              </label>

              <button class="secondary-button" type="submit" :disabled="actionLoading">
                {{ actionLoading ? "Saving..." : "Post Comment" }}
              </button>
            </form>
          </div>
        </PanelCard>

        <PanelCard
          v-if="canArchive || isAlreadyArchived"
          title="Archive (audit-safe delete)"
          description="Hard deletes are blocked. Archiving moves the incident to REJECTED with an audit trail."
        >
          <div v-if="isAlreadyArchived" class="detail-note">
            <strong>Already archived.</strong>
            This incident is preserved in the register with status <strong>REJECTED</strong> and the <code>archived</code> tag.
          </div>

          <form v-else-if="canArchive" class="action-form" @submit.prevent="archiveIncident">
            <label>
              <span>Reason</span>
              <textarea
                v-model="archiveReason"
                rows="3"
                placeholder="Why is this incident being removed from active work?"
                required
              />
            </label>

            <button class="danger-button" type="submit" :disabled="actionLoading">
              {{ actionLoading ? "Archiving..." : "Archive Incident" }}
            </button>
          </form>
        </PanelCard>
      </section>

      <section v-show="activeTab === 'evidence'" class="page-grid">
        <PanelCard title="Attachments" description="Secure incident evidence with preview and download controls.">
          <AttachmentEvidenceList
            :attachments="incident.attachments"
            empty-message="No attachments linked yet."
          />
        </PanelCard>

        <PanelCard
          v-if="canUpload"
          title="Link New Evidence"
          description="Attach additional files to this incident record."
        >
          <form class="action-form" @submit.prevent="submitAttachment">
            <label class="dropzone-field" for="incident-evidence-input">
              <span>Attachment File</span>
              <input
                id="incident-evidence-input"
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
                @change="handleAttachmentSelection"
              />
              <strong>{{ selectedAttachmentFile?.name ?? "Select evidence file to attach" }}</strong>
              <small>The file stays behind authenticated download routes after upload.</small>
            </label>

            <div class="form-grid-two">
              <label>
                <span>Source Type</span>
                <select v-model="attachmentForm.source_type">
                  <option v-for="sourceType in metaOptions.source_types" :key="sourceType" :value="sourceType">
                    {{ formatSourceType(sourceType) }}
                  </option>
                </select>
              </label>

              <label>
                <span>Where it came from</span>
                <input
                  v-model="attachmentForm.source_label"
                  type="text"
                  placeholder="e.g. Email thread, warehouse note, customer screenshot"
                />
              </label>
            </div>

            <label>
              <span>Attachment Note</span>
              <textarea
                v-model="attachmentForm.notes"
                rows="3"
                placeholder="Explain what this evidence adds to the incident record."
              />
            </label>

            <button class="secondary-button" type="submit" :disabled="actionLoading">
              {{ actionLoading ? "Linking..." : "Link Evidence" }}
            </button>
          </form>
        </PanelCard>
      </section>

      <section v-show="activeTab === 'ai'" class="page-grid">
        <PanelCard
          title="AI Triage Suggestions"
          description="AI-generated suggestions. Tick the ones to promote into the incident."
        >
          <template #actions>
            <button
              v-if="canRunAi"
              class="primary-button"
              type="button"
              :disabled="actionLoading"
              @click="runAiAnalysis"
            >
              {{ actionLoading ? "Running..." : "Run AI Analysis" }}
            </button>
          </template>

          <div class="form-stack">
            <div class="detail-note">
              <strong>Provider Mode</strong>
              <span v-if="incident.ai_runtime?.configured">
                Live analysis enabled via
                {{ incident.ai_runtime.provider_label || formatProvider(incident.ai_runtime.provider) }}.
              </span>
              <span v-else>
                AI suggestions are running in standby mode using built-in heuristic rules.
              </span>
            </div>

            <template v-if="latestAiAnalysis">
              <div class="ai-summary-grid">
                <div class="ai-summary-card">
                  <small>Latest Run</small>
                  <strong>{{ formatDateTime(latestAiAnalysis.created_at) }}</strong>
                  <span>{{ formatProvider(latestAiAnalysis.provider) }}</span>
                </div>
                <div class="ai-summary-card">
                  <small>Confidence</small>
                  <strong>{{ Math.round((latestAiAnalysis.confidence_score ?? 0) * 100) }}%</strong>
                  <span>overall suggestion confidence</span>
                </div>
                <div class="ai-summary-card">
                  <small>Duplicate Signal</small>
                  <strong>{{ latestAiAnalysis.duplicate_candidate_code ?? "No strong match" }}</strong>
                  <span>{{ Math.round((latestAiAnalysis.duplicate_confidence ?? 0) * 100) }}% similarity confidence</span>
                </div>
              </div>

              <div class="ai-suggestion-list">
                <article v-for="item in aiFieldOptions" :key="item.field" class="ai-suggestion-row">
                  <label v-if="canApplyAi" class="ai-suggestion-select">
                    <input v-model="aiSelection" type="checkbox" :value="item.field" />
                    <span>Apply</span>
                  </label>

                  <div class="ai-suggestion-body">
                    <strong>{{ item.label }}</strong>
                    <div class="ai-suggestion-values">
                      <div>
                        <small>Current</small>
                        <p>{{ item.current }}</p>
                      </div>
                      <div>
                        <small>Suggested</small>
                        <p>{{ item.suggested }}</p>
                      </div>
                    </div>
                  </div>
                </article>
              </div>

              <div v-if="latestAiAnalysis.rationale" class="detail-note">
                <strong>Rationale</strong>
                <span>{{ latestAiAnalysis.rationale }}</span>
              </div>

              <button
                v-if="canApplyAi"
                class="secondary-button"
                type="button"
                :disabled="actionLoading || !aiSelection.length"
                @click="applyAiSuggestions"
              >
                {{ actionLoading ? "Applying..." : "Apply Selected Suggestions" }}
              </button>
            </template>

            <div v-else class="empty-inline">No AI analysis has been stored for this incident yet.</div>
          </div>
        </PanelCard>
      </section>

      <section v-show="activeTab === 'activity'" class="page-grid">
        <PanelCard title="Workflow History" description="Recorded state transitions and operational actions.">
          <ActivityList :items="incident.history" empty-message="No history entries yet." />
        </PanelCard>

        <PanelCard title="Comment Trail" description="Operational notes and reviewer collaboration.">
          <ul v-if="incident.comments.length" class="comment-list">
            <li v-for="comment in incident.comments" :key="comment.id" class="comment-row">
              <div class="comment-meta">
                <strong>{{ formatActor(comment.comment_by) }}</strong>
                <span>{{ new Date(comment.created_at).toLocaleString("en-MY") }}</span>
              </div>
              <p>{{ comment.body }}</p>
            </li>
          </ul>
          <div v-else class="empty-inline">No comments recorded yet.</div>
        </PanelCard>
      </section>
    </template>
  </div>
</template>
