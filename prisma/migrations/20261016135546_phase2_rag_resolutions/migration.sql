-- CreateTable
CREATE TABLE "resolutions" (
    "id" TEXT NOT NULL,
    "reference_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "complaint_text" TEXT NOT NULL,
    "resolution_text" TEXT NOT NULL,
    "resolution_outcome" VARCHAR(100) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "department_code" VARCHAR(50) NOT NULL,
    "department_id" TEXT,
    "complaint_id" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT true,
    "verification_status" VARCHAR(50) NOT NULL DEFAULT 'VERIFIED',
    "data_source" VARCHAR(100) NOT NULL DEFAULT 'SOP_KNOWLEDGE_BASE',
    "provenance" JSONB,
    "metadata" JSONB,
    "embedding_model" VARCHAR(100) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
    "embedding_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "embedding" vector(384),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolution_recommendations" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "suggested_steps" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidence_strength" VARCHAR(50) NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "evidence_limitations" JSONB NOT NULL,
    "human_review_required" BOOLEAN NOT NULL DEFAULT false,
    "review_reasons" JSONB NOT NULL,
    "model_provider" VARCHAR(100) NOT NULL,
    "model_identifier" VARCHAR(100) NOT NULL,
    "prompt_version" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'GENERATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolution_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_sources" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "resolution_id" TEXT NOT NULL,
    "similarity_score" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "citation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_feedback" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "was_accepted" BOOLEAN NOT NULL,
    "agent_modifications" TEXT,
    "agent_rating" INTEGER,
    "feedback_notes" TEXT,
    "submitted_by" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "assigned_by" VARCHAR(100) NOT NULL DEFAULT 'SYSTEM_NLP_ROUTER',
    "assigned_to" VARCHAR(100),
    "notes" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resolutions_reference_code_key" ON "resolutions"("reference_code");

-- CreateIndex
CREATE INDEX "resolutions_category_idx" ON "resolutions"("category");

-- CreateIndex
CREATE INDEX "resolutions_department_code_idx" ON "resolutions"("department_code");

-- CreateIndex
CREATE INDEX "resolutions_is_verified_idx" ON "resolutions"("is_verified");

-- CreateIndex
CREATE INDEX "resolutions_embedding_status_idx" ON "resolutions"("embedding_status");

-- CreateIndex
CREATE INDEX "resolution_recommendations_complaint_id_idx" ON "resolution_recommendations"("complaint_id");

-- CreateIndex
CREATE INDEX "resolution_recommendations_evidence_strength_idx" ON "resolution_recommendations"("evidence_strength");

-- CreateIndex
CREATE INDEX "resolution_recommendations_human_review_required_idx" ON "resolution_recommendations"("human_review_required");

-- CreateIndex
CREATE INDEX "recommendation_sources_recommendation_id_idx" ON "recommendation_sources"("recommendation_id");

-- CreateIndex
CREATE INDEX "recommendation_sources_resolution_id_idx" ON "recommendation_sources"("resolution_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_sources_recommendation_id_resolution_id_key" ON "recommendation_sources"("recommendation_id", "resolution_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_feedback_recommendation_id_key" ON "recommendation_feedback"("recommendation_id");

-- CreateIndex
CREATE INDEX "assignments_complaint_id_idx" ON "assignments"("complaint_id");

-- CreateIndex
CREATE INDEX "assignments_department_id_idx" ON "assignments"("department_id");

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_recommendations" ADD CONSTRAINT "resolution_recommendations_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_sources" ADD CONSTRAINT "recommendation_sources_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "resolution_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_sources" ADD CONSTRAINT "recommendation_sources_resolution_id_fkey" FOREIGN KEY ("resolution_id") REFERENCES "resolutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "resolution_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: HNSW Vector Index for Sub-Millisecond Cosine Similarity Search
CREATE INDEX IF NOT EXISTS "resolutions_embedding_hnsw_idx" ON "resolutions" USING hnsw ("embedding" vector_cosine_ops);
