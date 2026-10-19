-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('PENDING', 'ANALYZED', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "reference_number" VARCHAR(50) NOT NULL,
    "original_text" TEXT NOT NULL,
    "sanitized_text" TEXT,
    "source" VARCHAR(50) NOT NULL DEFAULT 'WEB',
    "status" "ComplaintStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_analyses" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "predicted_category" VARCHAR(100) NOT NULL,
    "category_confidence" DOUBLE PRECISION NOT NULL,
    "category_probabilities" JSONB,
    "sentiment_label" VARCHAR(50) NOT NULL,
    "sentiment_score" DOUBLE PRECISION NOT NULL,
    "sentiment_compound" DOUBLE PRECISION,
    "sentiment_scores" JSONB,
    "emotion_primary" VARCHAR(50) NOT NULL,
    "emotion_confidence" DOUBLE PRECISION NOT NULL,
    "emotion_scores" JSONB,
    "emotion_secondary" TEXT[],
    "urgency_level" "UrgencyLevel" NOT NULL,
    "urgency_score" INTEGER NOT NULL,
    "urgency_reasons" JSONB NOT NULL,
    "human_review_required" BOOLEAN NOT NULL DEFAULT false,
    "recommended_department_id" TEXT,
    "department_code" VARCHAR(50) NOT NULL,
    "model_versions" JSONB NOT NULL,
    "analysis_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_reference_number_key" ON "complaints"("reference_number");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "complaints_created_at_idx" ON "complaints"("created_at");

-- CreateIndex
CREATE INDEX "complaint_analyses_complaint_id_idx" ON "complaint_analyses"("complaint_id");

-- CreateIndex
CREATE INDEX "complaint_analyses_predicted_category_idx" ON "complaint_analyses"("predicted_category");

-- CreateIndex
CREATE INDEX "complaint_analyses_urgency_level_idx" ON "complaint_analyses"("urgency_level");

-- CreateIndex
CREATE INDEX "complaint_analyses_department_code_idx" ON "complaint_analyses"("department_code");

-- AddForeignKey
ALTER TABLE "complaint_analyses" ADD CONSTRAINT "complaint_analyses_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_analyses" ADD CONSTRAINT "complaint_analyses_recommended_department_id_fkey" FOREIGN KEY ("recommended_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
