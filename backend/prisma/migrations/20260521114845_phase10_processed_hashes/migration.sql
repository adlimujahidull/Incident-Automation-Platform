-- CreateTable
CREATE TABLE "processed_hashes" (
    "id" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "source_channel" TEXT NOT NULL,
    "source_reference" TEXT,
    "process_name" TEXT,
    "job_reference" TEXT,
    "related_incident_id" TEXT,
    "result" TEXT NOT NULL DEFAULT 'CREATED',
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_hashes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processed_hashes_content_hash_idx" ON "processed_hashes"("content_hash");

-- CreateIndex
CREATE INDEX "processed_hashes_processed_at_idx" ON "processed_hashes"("processed_at");

-- CreateIndex
CREATE INDEX "processed_hashes_job_reference_idx" ON "processed_hashes"("job_reference");
