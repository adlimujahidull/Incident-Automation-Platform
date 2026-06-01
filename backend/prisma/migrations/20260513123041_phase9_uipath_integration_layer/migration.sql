-- AlterTable
ALTER TABLE "automation_logs" ADD COLUMN     "event_type" TEXT,
ADD COLUMN     "job_reference" TEXT,
ADD COLUMN     "source_system" TEXT NOT NULL DEFAULT 'INTERNAL';

-- CreateTable
CREATE TABLE "uipath_jobs" (
    "id" TEXT NOT NULL,
    "job_reference" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "source_channel" TEXT NOT NULL,
    "source_reference" TEXT,
    "status" TEXT NOT NULL,
    "payload_snapshot" JSONB,
    "result_payload" JSONB,
    "extracted_text" TEXT,
    "summary_report" TEXT,
    "retry_attempts" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "screenshot_path" TEXT,
    "related_incident_id" TEXT,
    "last_callback_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uipath_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uipath_jobs_job_reference_key" ON "uipath_jobs"("job_reference");

-- CreateIndex
CREATE INDEX "uipath_jobs_status_idx" ON "uipath_jobs"("status");

-- CreateIndex
CREATE INDEX "uipath_jobs_source_channel_idx" ON "uipath_jobs"("source_channel");

-- CreateIndex
CREATE INDEX "uipath_jobs_related_incident_id_idx" ON "uipath_jobs"("related_incident_id");

-- CreateIndex
CREATE INDEX "uipath_jobs_updated_at_idx" ON "uipath_jobs"("updated_at");

-- CreateIndex
CREATE INDEX "automation_logs_source_system_idx" ON "automation_logs"("source_system");

-- CreateIndex
CREATE INDEX "automation_logs_job_reference_idx" ON "automation_logs"("job_reference");

-- AddForeignKey
ALTER TABLE "uipath_jobs" ADD CONSTRAINT "uipath_jobs_related_incident_id_fkey" FOREIGN KEY ("related_incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
