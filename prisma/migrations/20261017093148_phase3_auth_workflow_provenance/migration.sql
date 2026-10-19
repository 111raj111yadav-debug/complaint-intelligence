-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'AGENT', 'AUDITOR');

-- DropIndex
DROP INDEX "resolutions_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "assigned_by_user_id" TEXT,
ADD COLUMN     "assigned_to_user_id" TEXT,
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "is_current" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reassign_reason" TEXT;

-- AlterTable
ALTER TABLE "complaints" ADD COLUMN     "first_assigned_at" TIMESTAMP(3),
ADD COLUMN     "is_overdue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "sla_deadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "recommendation_feedback" ADD COLUMN     "feedback_decision" VARCHAR(50) NOT NULL DEFAULT 'ACCEPTED',
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "rubric_scores" JSONB,
ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "resolutions" ADD COLUMN     "content_type" VARCHAR(50) NOT NULL DEFAULT 'REGULATORY_PLAYBOOK',
ADD COLUMN     "last_verified_at" TIMESTAMP(3),
ADD COLUMN     "source_org" VARCHAR(100),
ADD COLUMN     "source_title" VARCHAR(255),
ADD COLUMN     "source_url" VARCHAR(500),
ADD COLUMN     "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0';

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "department_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_audit_logs" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "from_status" "ComplaintStatus",
    "to_status" "ComplaintStatus" NOT NULL,
    "actor_id" TEXT,
    "actor_name" VARCHAR(100),
    "action" VARCHAR(50) NOT NULL DEFAULT 'STATUS_CHANGE',
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "complaint_audit_logs_complaint_id_idx" ON "complaint_audit_logs"("complaint_id");

-- CreateIndex
CREATE INDEX "complaint_audit_logs_created_at_idx" ON "complaint_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "assignments_is_current_idx" ON "assignments"("is_current");

-- CreateIndex
CREATE INDEX "complaints_is_overdue_idx" ON "complaints"("is_overdue");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_audit_logs" ADD CONSTRAINT "complaint_audit_logs_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_audit_logs" ADD CONSTRAINT "complaint_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
