/*
  Warnings:

  - Added the required column `checksum_sha256` to the `incident_attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_extension` to the `incident_attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ingestion_status` to the `incident_attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source_type` to the `incident_attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storage_name` to the `incident_attachments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "incident_attachments" ADD COLUMN     "checksum_sha256" TEXT NOT NULL,
ADD COLUMN     "file_extension" TEXT NOT NULL,
ADD COLUMN     "ingestion_status" TEXT NOT NULL,
ADD COLUMN     "intake_reference" TEXT,
ADD COLUMN     "linked_at" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "source_label" TEXT,
ADD COLUMN     "source_type" TEXT NOT NULL,
ADD COLUMN     "storage_name" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "incident_attachments_ingestion_status_idx" ON "incident_attachments"("ingestion_status");

-- CreateIndex
CREATE INDEX "incident_attachments_source_type_idx" ON "incident_attachments"("source_type");

-- CreateIndex
CREATE INDEX "incident_attachments_checksum_sha256_idx" ON "incident_attachments"("checksum_sha256");
