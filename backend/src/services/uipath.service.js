import { env } from "../config/env.js";
import { aiService } from "./ai.service.js";
import { automationLogService } from "./automation-log.service.js";
import { incidentService } from "./incident.service.js";
import { uipathJobRepository } from "../repositories/uipath-job.repository.js";
import { processedHashRepository } from "../repositories/processed-hash.repository.js";
import { HttpError } from "../utils/http-error.js";
import { uipathJobStatuses, uipathSourceChannels } from "../constants/incident.constants.js";

function buildMachineActor(processName) {
  return `uipath:${processName}`;
}

function mapJobStatusToAutomationResult(status, explicitResult) {
  if (explicitResult) {
    return explicitResult;
  }

  if (status === "RETRYING") {
    return "RETRYING";
  }

  if (status === "FAILED" || status === "REVIEW_REQUIRED") {
    return "FAILED";
  }

  return "SUCCESS";
}

function buildJobDetail(job, automationLogs, workflowWarning = null) {
  return {
    ...job,
    automation_logs: automationLogs,
    workflow_warning: workflowWarning
  };
}

function resolveBaseUrl(baseUrl) {
  if (baseUrl) {
    return baseUrl.replace(/\/$/, "");
  }

  return env.corsOrigin.replace(/\/$/, "");
}

function buildCallbackEventType(status, workflowWarning) {
  if (workflowWarning) {
    return "CALLBACK_REVIEW_REQUIRED";
  }

  return `JOB_${status}`;
}

function buildTerminalCompletedAt(status, completedAt) {
  if (completedAt) {
    return new Date(completedAt);
  }

  if (status === "FAILED" || status === "COMPLETED") {
    return new Date();
  }

  return null;
}

async function writeUiPathLog(payload) {
  return automationLogService.createLog({
    ...payload,
    source_system: "UIPATH"
  });
}

export const uipathService = {
  async listJobs(filters = {}) {
    return uipathJobRepository.list(filters);
  },

  async getJob(jobReference, workflowWarning = null) {
    const job = await uipathJobRepository.findByJobReference(jobReference);

    if (!job) {
      throw new HttpError(404, "UiPath job was not found");
    }

    const automationLogs = await automationLogService.listByJobReference(jobReference);
    return buildJobDetail(job, automationLogs, workflowWarning);
  },

  getManifest(baseUrl) {
    const rootUrl = resolveBaseUrl(baseUrl);
    const aiRuntime = aiService.getRuntimeStatus();

    return {
      integration_name: "UiPath Orchestrator Bridge",
      auth: {
        mode: "shared-secret",
        header_name: "x-uipath-key",
        secret_configured: Boolean(env.uipathSharedSecret)
      },
      ai: {
        configured: aiRuntime.configured,
        provider: aiRuntime.provider,
        mode: aiRuntime.mode
      },
      supported_source_channels: uipathSourceChannels,
      supported_job_statuses: uipathJobStatuses,
      recommended_incident_statuses: ["PROCESSING", "OPEN", "FAILED", "RESOLVED"],
      endpoints: {
        intake: `${rootUrl}/api/uipath/jobs/intake`,
        status_callback: `${rootUrl}/api/uipath/jobs/{job_reference}/status`,
        jobs: `${rootUrl}/api/uipath/jobs`,
        job_detail: `${rootUrl}/api/uipath/jobs/{job_reference}`
      },
      notes: [
        "Use attachment_ids when UiPath already staged evidence through the secure upload contract.",
        "Create incident payloads should set source_type implicitly through the bridge as RPA.",
        "Callbacks may append incident comments or request status transitions after the job is linked to an incident."
      ],
      contracts: {
        intake_example: {
          job_reference: "UIP-20260513-0007",
          process_name: "UiPath Inbox Intake",
          source_channel: "EMAIL_QUEUE",
          source_reference: "mailbox/dhl-ops/2026/05/13/claim-0007",
          create_incident: true,
          extracted_text: "Parcel damage note extracted from inbound email and PDF evidence.",
          payload_snapshot: {
            mailbox: "dhl-ops@local",
            trigger: "unread-email"
          },
          incident: {
            title: "Parcel damage complaint from monitored inbox",
            summary: "UiPath extracted a customer complaint and evidence bundle that requires warehouse review.",
            category: "Damaged Parcel",
            priority: "High",
            assigned_department: "Warehouse",
            tags: ["uipath", "email", "damage"],
            suggested_action: "Validate damage evidence and coordinate compensation review.",
            attachment_ids: ["att_123"],
            status: "PROCESSING",
            notes: "Auto-created from UiPath inbox intake."
          }
        },
        status_callback_example: {
          status: "COMPLETED",
          retry_attempts: 1,
          incident_status: "OPEN",
          incident_comment: "OCR and document classification finished successfully.",
          result_payload: {
            classifier: "damage-claim-v2",
            confidence: 0.91
          }
        }
      }
    };
  },

  async receiveIntake(payload) {
    const existingJob = await uipathJobRepository.findByJobReference(payload.job_reference);

    if (existingJob) {
      return {
        accepted: true,
        idempotent: true,
        incident_created: Boolean(existingJob.related_incident_id),
        incident_creation_error: null,
        job: await this.getJob(existingJob.job_reference)
      };
    }

    const now = new Date();
    const shouldCreateIncident = payload.create_incident ?? Boolean(payload.incident);
    const initialStatus = shouldCreateIncident ? "PROCESSING" : payload.failure_reason ? "REVIEW_REQUIRED" : "RECEIVED";

    let job = await uipathJobRepository.create({
      job_reference: payload.job_reference,
      process_name: payload.process_name,
      source_channel: payload.source_channel,
      source_reference: payload.source_reference ?? null,
      status: initialStatus,
      payload_snapshot: payload.payload_snapshot ?? null,
      result_payload: payload.result_payload ?? null,
      extracted_text: payload.extracted_text ?? null,
      summary_report: payload.summary_report ?? null,
      retry_attempts: payload.retry_attempts ?? 0,
      failure_reason: payload.failure_reason ?? null,
      screenshot_path: payload.screenshot_path ?? null,
      related_incident_id: null,
      last_callback_at: now,
      completed_at: null
    });

    await writeUiPathLog({
      process_name: payload.process_name,
      result: "SUCCESS",
      job_reference: payload.job_reference,
      event_type: "JOB_RECEIVED",
      retry_attempts: payload.retry_attempts ?? 0,
      payload_snapshot: payload.payload_snapshot ?? null,
      related_incident_id: null,
      executed_at: now
    });

    let incident = null;
    let incidentCreationError = null;
    let aiSeeded = false;

    if (shouldCreateIncident && (payload.incident || payload.extracted_text)) {
      const machineActor = buildMachineActor(payload.process_name);
      const seedFromText = !payload.incident && payload.extracted_text
        ? aiService.buildSeedFromText(payload.extracted_text, { source_type: "RPA" })
        : null;

      const incidentSeed = payload.incident ?? seedFromText;
      aiSeeded = Boolean(seedFromText);

      try {
        incident = await incidentService.createIncident(
          {
            title: incidentSeed.title,
            summary: incidentSeed.summary,
            category: incidentSeed.category,
            priority: incidentSeed.priority,
            status: incidentSeed?.status ?? "PROCESSING",
            source_type: "RPA",
            assigned_department: incidentSeed.assigned_department,
            tags: [
              ...(incidentSeed.tags ?? []),
              ...(aiSeeded ? ["rpa-intake", "ai-seeded"] : ["rpa-intake"])
            ].slice(0, 12),
            suggested_action: incidentSeed.suggested_action ?? null,
            attachment_ids: incidentSeed.attachment_ids ?? []
          },
          payload.incident?.created_by ?? machineActor
        );

        if (payload.incident?.notes) {
          await incidentService.addComment(
            incident.id,
            { body: payload.incident.notes },
            payload.incident.created_by ?? machineActor
          );
        } else if (aiSeeded) {
          await incidentService.addComment(
            incident.id,
            {
              body: `Incident draft auto-generated by UiPath bot using extracted text and heuristic AI seeding (${incidentSeed.category} / ${incidentSeed.priority}). Reviewer should run full AI triage and confirm before assignment.`
            },
            machineActor
          );
        }

        job = await uipathJobRepository.updateByJobReference(payload.job_reference, {
          status: "INCIDENT_CREATED",
          related_incident_id: incident.id,
          last_callback_at: new Date()
        });

        if (aiSeeded) {
          try {
            await incidentService.runAiAnalysis(incident.id, buildMachineActor(payload.process_name));
          } catch (aiError) {
            await writeUiPathLog({
              process_name: payload.process_name,
              result: "FAILED",
              job_reference: payload.job_reference,
              event_type: "AI_AUTO_TRIAGE_FAILED",
              error_message: aiError.message,
              retry_attempts: payload.retry_attempts ?? 0,
              payload_snapshot: { incident_code: incident.incident_code },
              related_incident_id: incident.id,
              executed_at: new Date()
            });
          }
        }

        await writeUiPathLog({
          process_name: payload.process_name,
          result: "SUCCESS",
          job_reference: payload.job_reference,
          event_type: "INCIDENT_CREATED",
          retry_attempts: payload.retry_attempts ?? 0,
          payload_snapshot: {
            incident_code: incident.incident_code,
            source_channel: payload.source_channel
          },
          related_incident_id: incident.id,
          executed_at: new Date()
        });
      } catch (error) {
        incidentCreationError = error.message;
        job = await uipathJobRepository.updateByJobReference(payload.job_reference, {
          status: "REVIEW_REQUIRED",
          failure_reason: error.message,
          last_callback_at: new Date()
        });

        await writeUiPathLog({
          process_name: payload.process_name,
          result: "FAILED",
          job_reference: payload.job_reference,
          event_type: "INCIDENT_CREATION_FAILED",
          error_message: error.message,
          retry_attempts: payload.retry_attempts ?? 0,
          payload_snapshot: payload.payload_snapshot ?? null,
          related_incident_id: null,
          executed_at: new Date()
        });
      }
    }

    if (payload.content_hash) {
      try {
        await processedHashRepository.record({
          content_hash: payload.content_hash,
          source_channel: payload.source_channel,
          source_reference: payload.source_reference ?? null,
          process_name: payload.process_name,
          job_reference: payload.job_reference,
          related_incident_id: incident?.id ?? null,
          result: incident ? "CREATED" : incidentCreationError ? "FAILED" : "RECEIVED"
        });
      } catch {
        // best-effort; do not block intake on hash record failure
      }
    }

    return {
      accepted: true,
      idempotent: false,
      incident_created: Boolean(incident),
      incident_creation_error: incidentCreationError,
      job: await this.getJob(job.job_reference),
      incident
    };
  },

  async updateJobStatus(jobReference, payload) {
    const existingJob = await uipathJobRepository.findByJobReference(jobReference);

    if (!existingJob) {
      throw new HttpError(404, "UiPath job was not found");
    }

    const actor = buildMachineActor(existingJob.process_name);
    let workflowWarning = null;

    if (!existingJob.related_incident_id && (payload.incident_comment || payload.incident_status)) {
      workflowWarning = "UiPath callback referenced incident actions before an incident was linked";
    }

    if (existingJob.related_incident_id && payload.incident_comment && !payload.incident_status && !workflowWarning) {
      try {
        await incidentService.addComment(existingJob.related_incident_id, { body: payload.incident_comment }, actor);
      } catch (error) {
        workflowWarning = error.message;
      }
    }

    if (existingJob.related_incident_id && payload.incident_status && !workflowWarning) {
      try {
        await incidentService.updateStatus(
          existingJob.related_incident_id,
          {
            status: payload.incident_status,
            comment: payload.incident_comment ?? payload.failure_reason ?? null
          },
          actor
        );
      } catch (error) {
        workflowWarning = error.message;
      }
    }

    const nextStatus = workflowWarning ? "REVIEW_REQUIRED" : payload.status;
    const callbackTimestamp = payload.last_callback_at ? new Date(payload.last_callback_at) : new Date();

    await uipathJobRepository.updateByJobReference(jobReference, {
      status: nextStatus,
      retry_attempts: payload.retry_attempts ?? existingJob.retry_attempts,
      failure_reason: workflowWarning ?? payload.failure_reason ?? existingJob.failure_reason ?? null,
      screenshot_path: payload.screenshot_path ?? existingJob.screenshot_path ?? null,
      result_payload: payload.result_payload ?? existingJob.result_payload ?? null,
      summary_report: payload.summary_report ?? existingJob.summary_report ?? null,
      last_callback_at: callbackTimestamp,
      completed_at: buildTerminalCompletedAt(nextStatus, payload.completed_at) ?? existingJob.completed_at ?? null
    });

    await writeUiPathLog({
      process_name: existingJob.process_name,
      result: mapJobStatusToAutomationResult(nextStatus, workflowWarning ? "FAILED" : payload.result),
      job_reference: jobReference,
      event_type: buildCallbackEventType(nextStatus, workflowWarning),
      error_message: workflowWarning ?? payload.failure_reason ?? null,
      screenshot_path: payload.screenshot_path ?? existingJob.screenshot_path ?? undefined,
      retry_attempts: payload.retry_attempts ?? existingJob.retry_attempts,
      payload_snapshot: payload.result_payload ?? existingJob.result_payload ?? existingJob.payload_snapshot ?? null,
      related_incident_id: existingJob.related_incident_id ?? null,
      executed_at: callbackTimestamp
    });

    return this.getJob(jobReference, workflowWarning);
  },

  async checkDuplicateHash(payload) {
    const windowDays = payload.window_days ?? 14;
    const existing = await processedHashRepository.findRecentByHash(payload.content_hash, windowDays);

    if (!existing) {
      return {
        duplicate: false,
        window_days: windowDays,
        content_hash: payload.content_hash
      };
    }

    return {
      duplicate: true,
      window_days: windowDays,
      content_hash: payload.content_hash,
      original_processed_at: existing.processed_at,
      original_job_reference: existing.job_reference,
      original_source_reference: existing.source_reference,
      original_incident_id: existing.related_incident_id
    };
  },

  async recordRunSummary(payload) {
    const startedAt = payload.started_at ? new Date(payload.started_at) : null;
    const finishedAt = payload.finished_at ? new Date(payload.finished_at) : new Date();

    await writeUiPathLog({
      process_name: payload.process_name,
      result:
        payload.totals.failed > 0
          ? "FAILED"
          : payload.totals.created + payload.totals.updated > 0
            ? "SUCCESS"
            : "RETRYING",
      job_reference: payload.job_reference,
      event_type: "RUN_SUMMARY_EMAIL",
      retry_attempts: 0,
      payload_snapshot: {
        totals: payload.totals,
        email_target: payload.email_target ?? null,
        started_at: startedAt,
        log_excerpt: payload.log_excerpt ?? null,
        summary_excerpt: payload.summary_report.slice(0, 600)
      },
      related_incident_id: null,
      executed_at: finishedAt
    });

    const existingJob = await uipathJobRepository.findByJobReference(payload.job_reference);

    if (existingJob) {
      await uipathJobRepository.updateByJobReference(payload.job_reference, {
        summary_report: payload.summary_report,
        last_callback_at: finishedAt
      });
    }

    return {
      accepted: true,
      job_reference: payload.job_reference,
      totals: payload.totals,
      email_target: payload.email_target ?? null,
      recorded_at: finishedAt
    };
  },

  async generateJobSummary(jobReference) {
    const job = await uipathJobRepository.findByJobReference(jobReference);
    if (!job) {
      throw new HttpError(404, "UiPath job was not found");
    }

    const logs = await automationLogService.listByJobReference(jobReference);
    const summary = await aiService.generateJobSummary(job, logs);
    return { summary };
  }
};
