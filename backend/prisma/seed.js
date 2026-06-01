import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prismaPackage from "@prisma/client";

import { ensureUploadDirectory } from "../src/config/storage.js";

const { PrismaClient } = prismaPackage;

const prisma = new PrismaClient();

// Helper: returns a Date N days ago, at the given UTC hour
function daysAgo(n, h = 9) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(h, 0, 0, 0);
  return d;
}

function createSeedAttachment(relativePath, content) {
  const baseDirectory = ensureUploadDirectory(path.dirname(relativePath));
  const absolutePath = path.join(baseDirectory, path.basename(relativePath));

  fs.writeFileSync(absolutePath, content, "utf8");

  return {
    storage_name: path.basename(relativePath),
    file_path: relativePath.replace(/\\/g, "/"),
    checksum_sha256: createHash("sha256").update(content).digest("hex"),
    size_bytes: Buffer.byteLength(content, "utf8")
  };
}

export async function seedUsers() {
  const passwordHash = await bcrypt.hash(process.env.DEFAULT_DEMO_PASSWORD ?? "Passw0rd!", 10);

  const users = [
    {
      name: process.env.DEFAULT_ADMIN_NAME ?? "Operations Admin",
      email: process.env.DEFAULT_ADMIN_EMAIL ?? "admin.ops@dhl.local",
      role: "ADMIN",
      department: "Command Center"
    },
    {
      name: "Case Reviewer",
      email: "reviewer.ops@dhl.local",
      role: "REVIEWER",
      department: "Customer Support"
    },
    {
      name: "Support Coordinator",
      email: "support.ops@dhl.local",
      role: "SUPPORT_STAFF",
      department: "Delivery Operations"
    }
  ];

  await Promise.all(
    users.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          role: user.role,
          department: user.department
        },
        create: {
          ...user,
          password_hash: passwordHash
        }
      })
    )
  );
}

export async function seedIncidents() {
  if ((await prisma.incident.count()) > 0) {
    return;
  }

  const reviewer = await prisma.user.findUnique({
    where: { email: "reviewer.ops@dhl.local" }
  });
  const support = await prisma.user.findUnique({
    where: { email: "support.ops@dhl.local" }
  });

  // Spread seed incidents across the 14-day trend window so the chart shows
  // realistic distribution instead of every incident landing on today.
  const t1 = daysAgo(11, 8);  // INC-SEED-0001 — damaged parcel, 11 days ago
  const t2 = daysAgo(7, 10);  // INC-SEED-0002 — tracking failure, 7 days ago
  const t3 = daysAgo(7, 14);  // INC-SEED-0003 — duplicate of 0001, same day as 0002
  const t4 = daysAgo(3, 9);   // INC-SEED-0004 — OCR failure, 3 days ago

  const primaryIncident = await prisma.incident.create({
    data: {
      incident_code: "INC-SEED-0001",
      title: "Damaged parcel reported from Johor Bahru sortation line",
      summary:
        "Warehouse note and customer image set show a crushed parcel with torn outer packaging after morning sortation. Escalation requested for compensation review.",
      category: "Damaged Parcel",
      priority: "High",
      status: "ASSIGNED",
      source_type: "MANUAL_UPLOAD",
      assigned_department: "Warehouse",
      assigned_to_user_id: reviewer?.id ?? null,
      assigned_at: new Date(t1.getTime() + 1000 * 60 * 40),
      tags: ["damage", "sortation", "claim"],
      suggested_action: "Validate damage evidence and coordinate compensation response with support.",
      created_by: "admin.ops@dhl.local",
      created_at: t1
    }
  });

  const trackingIncident = await prisma.incident.create({
    data: {
      incident_code: "INC-SEED-0002",
      title: "Tracking event missing for outbound parcel after dispatch",
      summary:
        "Customer support escalated a parcel that left the facility but did not produce downstream tracking updates for more than twelve hours.",
      category: "Tracking Failure",
      priority: "Medium",
      status: "IN REVIEW",
      source_type: "EMAIL",
      assigned_department: "Technical Support",
      assigned_to_user_id: reviewer?.id ?? null,
      assigned_at: new Date(t2.getTime() + 1000 * 60 * 60),
      tags: ["tracking", "customer-follow-up"],
      suggested_action: "Investigate scanner synchronization and verify handoff event integrity.",
      created_by: "reviewer.ops@dhl.local",
      created_at: t2
    }
  });

  await prisma.incident.create({
    data: {
      incident_code: "INC-SEED-0003",
      title: "Duplicate parcel damage complaint from repeat customer email thread",
      summary:
        "Follow-up customer email repeats the same damage evidence and complaint already opened in the morning sortation incident.",
      category: "Damaged Parcel",
      priority: "High",
      status: "DUPLICATE",
      source_type: "EMAIL",
      assigned_department: "Customer Support",
      assigned_to_user_id: support?.id ?? null,
      assigned_at: new Date(t3.getTime() + 1000 * 60 * 30),
      tags: ["duplicate", "damage"],
      suggested_action: "Link the repeated complaint to the original damage case and notify the assigned reviewer.",
      created_by: "support.ops@dhl.local",
      duplicate_of: primaryIncident.id,
      created_at: t3
    }
  });

  const failedIncident = await prisma.incident.create({
    data: {
      incident_code: "INC-SEED-0004",
      title: "Inbound OCR extraction failed for handwritten warehouse delay note",
      summary:
        "UiPath ingestion picked up a handwritten delay note but OCR confidence was too low for structured extraction, requiring manual review.",
      category: "Warehouse Delay",
      priority: "Low",
      status: "FAILED",
      source_type: "RPA",
      assigned_department: "Warehouse",
      tags: ["ocr", "warehouse-delay"],
      suggested_action: "Route raw evidence for manual review and improve OCR fallback handling.",
      created_by: "system",
      created_at: t4
    }
  });

  // NOTE: IncidentHistory is no longer seeded to provide a clean slate
  // for the Operational Activity feed on the dashboard. History will be
  // generated organically through user actions.

  await prisma.incidentComment.createMany({
    data: [
      {
        incident_id: primaryIncident.id,
        body: "Damage evidence reviewed. Warehouse team should confirm whether compensation workflow needs to be triggered today.",
        comment_by: "reviewer.ops@dhl.local",
        created_at: new Date(t1.getTime() + 1000 * 60 * 55)
      },
      {
        incident_id: trackingIncident.id,
        body: "Scanner handoff records are incomplete. Waiting for technical support trace from the outbound checkpoint.",
        comment_by: "reviewer.ops@dhl.local",
        created_at: new Date(t2.getTime() + 1000 * 60 * 125)
      }
    ]
  });

  const damagedParcelEvidence = createSeedAttachment(
    path.join("seed", "damaged-parcel-note.txt"),
    [
      "Warehouse Sortation Note",
      "Location: Johor Bahru line 4",
      "Observation: Outer carton crushed on left edge.",
      "Action: Keep parcel on hold for damage review and customer compensation response."
    ].join("\n")
  );

  const ocrFailureEvidence = createSeedAttachment(
    path.join("seed", "ocr-low-confidence-note.txt"),
    [
      "Handwritten warehouse delay note collected by UiPath OCR.",
      "Confidence score: 0.41",
      "Reason for failure: Text too faint and slanted for structured extraction."
    ].join("\n")
  );

  await prisma.incidentAttachment.createMany({
    data: [
      {
        incident_id: primaryIncident.id,
        file_name: "damaged-parcel-note.txt",
        storage_name: damagedParcelEvidence.storage_name,
        file_path: damagedParcelEvidence.file_path,
        file_type: "text/plain",
        file_extension: ".txt",
        source_type: "MANUAL_UPLOAD",
        source_label: "Warehouse desk note",
        intake_reference: "WAREHOUSE-NOTE-001",
        notes: "Initial evidence note attached during manual intake.",
        ingestion_status: "LINKED",
        checksum_sha256: damagedParcelEvidence.checksum_sha256,
        uploaded_by: "admin.ops@dhl.local",
        uploaded_at: new Date(t1.getTime() + 1000 * 60 * 12),
        linked_at: new Date(t1.getTime() + 1000 * 60 * 12),
        size_bytes: damagedParcelEvidence.size_bytes
      },
      {
        incident_id: failedIncident.id,
        file_name: "ocr-low-confidence-note.txt",
        storage_name: ocrFailureEvidence.storage_name,
        file_path: ocrFailureEvidence.file_path,
        file_type: "text/plain",
        file_extension: ".txt",
        source_type: "RPA",
        source_label: "UiPath OCR queue",
        intake_reference: "OCR-FAIL-01",
        notes: "Raw OCR evidence retained for manual resolution.",
        ingestion_status: "LINKED",
        checksum_sha256: ocrFailureEvidence.checksum_sha256,
        uploaded_by: "system",
        uploaded_at: new Date(t4.getTime() + 1000 * 60 * 30),
        linked_at: new Date(t4.getTime() + 1000 * 60 * 30),
        size_bytes: ocrFailureEvidence.size_bytes
      }
    ]
  });

  await prisma.incidentAiAnalysis.createMany({
    data: [
      {
        incident_id: primaryIncident.id,
        provider: "HEURISTIC",
        model: null,
        status: "COMPLETED",
        title_suggestion: "Damaged parcel from Johor Bahru sortation requires compensation review",
        summary_suggestion:
          "Damage evidence indicates the parcel was crushed during sortation and should be reviewed by warehouse operations with compensation follow-up prepared for customer support.",
        category_suggestion: "Damaged Parcel",
        priority_suggestion: "High",
        department_suggestion: "Warehouse",
        tags_suggestion: ["damage", "warehouse", "claim", "sortation"],
        suggested_action_suggestion:
          "Confirm damage severity with warehouse staff, preserve evidence, and prepare customer compensation workflow if validated.",
        duplicate_candidate_id: null,
        duplicate_candidate_code: null,
        duplicate_candidate_title: null,
        duplicate_confidence: 0.22,
        confidence_score: 0.66,
        rationale:
          "Heuristic routing detects parcel damage language, warehouse ownership, and compensation risk. No stronger duplicate candidate was present in the baseline seed queue.",
        prompt_version: "incident-analysis-v1",
        source_snapshot: {
          incident_code: primaryIncident.incident_code,
          mode: "seed-demo"
        },
        raw_response: {
          seeded: true
        },
        error_message: null,
        created_by: "system",
        created_at: new Date(t1.getTime() + 1000 * 60 * 60)
      },
      {
        incident_id: failedIncident.id,
        provider: "HEURISTIC",
        model: null,
        status: "COMPLETED",
        title_suggestion: "OCR extraction failure requires manual warehouse review",
        summary_suggestion:
          "UiPath captured a handwritten warehouse delay note, but OCR confidence was too low for trusted extraction. Manual review should reconstruct the operational facts before routing.",
        category_suggestion: "System Error",
        priority_suggestion: "Medium",
        department_suggestion: "Technical Support",
        tags_suggestion: ["ocr", "manual-review", "warehouse-delay"],
        suggested_action_suggestion:
          "Review the raw evidence file, rebuild the structured summary manually, and investigate whether OCR tuning or escalation thresholds should be adjusted.",
        duplicate_candidate_id: null,
        duplicate_candidate_code: null,
        duplicate_candidate_title: null,
        duplicate_confidence: 0.14,
        confidence_score: 0.59,
        rationale:
          "The failure pattern suggests a technical/OCR pipeline issue with warehouse impact, so the recommendation routes to technical support with manual review follow-up.",
        prompt_version: "incident-analysis-v1",
        source_snapshot: {
          incident_code: "INC-SEED-0004",
          mode: "seed-demo"
        },
        raw_response: {
          seeded: true
        },
        error_message: null,
        created_by: "system",
        created_at: new Date(t4.getTime() + 1000 * 60 * 60)
      }
    ]
  });
}

export async function seedUiPathJobs() {
  if ((await prisma.uiPathJob.count()) > 0) {
    return;
  }

  const trackingIncident = await prisma.incident.findUnique({
    where: { incident_code: "INC-SEED-0002" }
  });
  const failedIncident = await prisma.incident.findUnique({
    where: { incident_code: "INC-SEED-0004" }
  });

  // Match job timestamps to incident creation dates: 7 and 3 days ago
  const job1Base = daysAgo(7, 10);
  const job2Base = daysAgo(3, 9);

  await prisma.uiPathJob.createMany({
    data: [
      {
        job_reference: "UIP-SEED-0001",
        process_name: "UiPath Inbox Intake",
        source_channel: "EMAIL_QUEUE",
        source_reference: "mailbox/dhl-ops/seed/0001",
        status: "COMPLETED",
        payload_snapshot: {
          mailbox: "dhl-ops@local",
          trigger: "seed-demo"
        },
        result_payload: {
          classifier: "tracking-gap-v1",
          confidence: 0.88
        },
        extracted_text: "Tracking exception email parsed from monitored mailbox.",
        summary_report: "Incident was created automatically and queued for reviewer confirmation.",
        retry_attempts: 0,
        failure_reason: null,
        screenshot_path: null,
        related_incident_id: trackingIncident?.id ?? null,
        last_callback_at: new Date(job1Base.getTime() + 1000 * 60 * 90),
        completed_at: new Date(job1Base.getTime() + 1000 * 60 * 92)
      },
      {
        job_reference: "UIP-SEED-0002",
        process_name: "OCR Note Extraction",
        source_channel: "OCR_QUEUE",
        source_reference: "ocr/warehouse-delay/seed/0002",
        status: "REVIEW_REQUIRED",
        payload_snapshot: {
          queue: "warehouse-delay-notes",
          trigger: "low-confidence-ocr"
        },
        result_payload: {
          ocr_confidence: 0.41
        },
        extracted_text: "Handwritten note could not be extracted with enough confidence.",
        summary_report: "Manual review is required before the incident can be routed cleanly.",
        retry_attempts: 2,
        failure_reason: "OCR confidence below operational threshold.",
        screenshot_path: null,
        related_incident_id: failedIncident?.id ?? null,
        last_callback_at: new Date(job2Base.getTime() + 1000 * 60 * 45),
        completed_at: null
      }
    ]
  });
}

export async function seedAutomationLogs() {
  if ((await prisma.automationLog.count()) > 0) {
    return;
  }

  const trackingIncident = await prisma.incident.findUnique({
    where: { incident_code: "INC-SEED-0002" }
  });
  const failedIncident = await prisma.incident.findUnique({
    where: { incident_code: "INC-SEED-0004" }
  });

  // Match log timestamps to corresponding incident dates
  const log1Base = daysAgo(7, 11);
  const log2Base = daysAgo(3, 10);

  await prisma.automationLog.createMany({
    data: [
      {
        process_name: "UiPath Inbox Intake",
        result: "SUCCESS",
        source_system: "UIPATH",
        job_reference: "UIP-SEED-0001",
        event_type: "JOB_COMPLETED",
        retry_attempts: 0,
        payload_snapshot: {
          classifier: "tracking-gap-v1",
          confidence: 0.88
        },
        related_incident_id: trackingIncident?.id ?? null,
        executed_at: new Date(log1Base.getTime() + 1000 * 60 * 30)
      },
      {
        process_name: "OCR Note Extraction",
        result: "FAILED",
        source_system: "UIPATH",
        job_reference: "UIP-SEED-0002",
        event_type: "CALLBACK_REVIEW_REQUIRED",
        error_message: "OCR confidence below operational threshold.",
        retry_attempts: 2,
        payload_snapshot: {
          ocr_confidence: 0.41
        },
        related_incident_id: failedIncident?.id ?? null,
        executed_at: new Date(log2Base.getTime() + 1000 * 60 * 15)
      }
    ]
  });
}

export async function runSeed() {
  await seedUsers();
  await seedIncidents();
  await seedUiPathJobs();
  await seedAutomationLogs();
}

async function main() {
  await runSeed();
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { prisma };
