-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "assigned_at" TIMESTAMP(3),
ADD COLUMN     "assigned_to_user_id" TEXT;

-- CreateIndex
CREATE INDEX "incidents_assigned_to_user_id_idx" ON "incidents"("assigned_to_user_id");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
