-- CreateTable
CREATE TABLE "incident_ai_analyses" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "title_suggestion" TEXT,
    "summary_suggestion" TEXT,
    "category_suggestion" TEXT,
    "priority_suggestion" TEXT,
    "department_suggestion" TEXT,
    "tags_suggestion" TEXT[],
    "suggested_action_suggestion" TEXT,
    "duplicate_candidate_id" TEXT,
    "duplicate_candidate_code" TEXT,
    "duplicate_candidate_title" TEXT,
    "duplicate_confidence" DOUBLE PRECISION,
    "confidence_score" DOUBLE PRECISION,
    "rationale" TEXT,
    "prompt_version" TEXT NOT NULL,
    "source_snapshot" JSONB,
    "raw_response" JSONB,
    "error_message" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_ai_analyses_incident_id_idx" ON "incident_ai_analyses"("incident_id");

-- CreateIndex
CREATE INDEX "incident_ai_analyses_status_idx" ON "incident_ai_analyses"("status");

-- CreateIndex
CREATE INDEX "incident_ai_analyses_created_at_idx" ON "incident_ai_analyses"("created_at");

-- AddForeignKey
ALTER TABLE "incident_ai_analyses" ADD CONSTRAINT "incident_ai_analyses_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
