ALTER TYPE "NotificationType" ADD VALUE 'LESSON_MODERATION_CHANGES_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'LESSON_MODERATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'LESSON_MODERATION_REMOVED';
ALTER TYPE "NotificationType" ADD VALUE 'LESSON_REPORT_RESOLVED';

BEGIN;

CREATE TYPE "LessonModerationStatus" AS ENUM (
    'CLEAR',
    'UNDER_REVIEW',
    'CHANGES_REQUESTED',
    'REMOVED'
);

CREATE TYPE "LessonModerationCaseStatus" AS ENUM (
    'REPORTED',
    'UNDER_REVIEW',
    'CHANGES_REQUESTED',
    'APPROVED',
    'DISMISSED',
    'REMOVED'
);

CREATE TYPE "LessonReportCategory" AS ENUM (
    'AGE_INAPPROPRIATE',
    'VIOLENCE',
    'HATE_OR_HARASSMENT',
    'SEXUAL_CONTENT',
    'PERSONAL_DATA',
    'MISINFORMATION',
    'OTHER'
);

CREATE TYPE "AdminAuditAction" AS ENUM (
    'USER_SUSPENDED',
    'USER_RESTORED',
    'LESSON_HIDDEN',
    'LESSON_REPORT_DISMISSED',
    'LESSON_CHANGES_REQUESTED',
    'LESSON_APPROVED',
    'LESSON_REMOVED'
);

CREATE TYPE "AdminAuditTargetType" AS ENUM (
    'USER',
    'LESSON',
    'MODERATION_CASE'
);

ALTER TABLE "Lesson"
    ADD COLUMN "moderationStatus" "LessonModerationStatus" NOT NULL DEFAULT 'CLEAR';

CREATE TABLE "LessonModerationCase" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" "LessonModerationCaseStatus" NOT NULL DEFAULT 'REPORTED',
    "initialSnapshot" JSONB NOT NULL,
    "resolutionNote" TEXT,
    "reviewedById" TEXT,
    "editVersion" INTEGER NOT NULL DEFAULT 1,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonModerationCase_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LessonModerationCase_editVersion_check" CHECK ("editVersion" >= 1),
    CONSTRAINT "LessonModerationCase_resolution_check" CHECK (
        (
            "status" IN ('APPROVED', 'DISMISSED', 'REMOVED')
            AND "resolvedAt" IS NOT NULL
        )
        OR
        (
            "status" IN ('REPORTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED')
            AND "resolvedAt" IS NULL
        )
    )
);

CREATE TABLE "LessonReport" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "subjectStudentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "category" "LessonReportCategory" NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LessonReport_details_check" CHECK (
        char_length(btrim("details")) BETWEEN 10 AND 2000
    )
);

CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "targetType" "AdminAuditTargetType" NOT NULL,
    "targetId" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdminAuditLog_targetId_check" CHECK (
        char_length(btrim("targetId")) > 0
    ),
    CONSTRAINT "AdminAuditLog_reason_check" CHECK (
        char_length(btrim("reason")) BETWEEN 10 AND 500
    )
);

ALTER TABLE "Lesson"
    ADD CONSTRAINT "Lesson_removed_moderation_check" CHECK (
        "moderationStatus" <> 'REMOVED' OR "status" = 'ARCHIVED'
    );

CREATE INDEX "Lesson_moderationStatus_updatedAt_idx"
    ON "Lesson"("moderationStatus", "updatedAt");

CREATE INDEX "LessonModerationCase_status_createdAt_id_idx"
    ON "LessonModerationCase"("status", "createdAt", "id");
CREATE INDEX "LessonModerationCase_lessonId_createdAt_idx"
    ON "LessonModerationCase"("lessonId", "createdAt");
CREATE INDEX "LessonModerationCase_reviewedById_updatedAt_idx"
    ON "LessonModerationCase"("reviewedById", "updatedAt");
CREATE UNIQUE INDEX "LessonModerationCase_one_active_per_lesson_key"
    ON "LessonModerationCase"("lessonId")
    WHERE "status" IN ('REPORTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED');

CREATE UNIQUE INDEX "LessonReport_caseId_reporterId_key"
    ON "LessonReport"("caseId", "reporterId");
CREATE INDEX "LessonReport_reporterId_createdAt_idx"
    ON "LessonReport"("reporterId", "createdAt");
CREATE INDEX "LessonReport_subjectStudentId_createdAt_idx"
    ON "LessonReport"("subjectStudentId", "createdAt");
CREATE INDEX "LessonReport_classId_createdAt_idx"
    ON "LessonReport"("classId", "createdAt");

CREATE INDEX "AdminAuditLog_actorId_createdAt_id_idx"
    ON "AdminAuditLog"("actorId", "createdAt", "id");
CREATE INDEX "AdminAuditLog_action_createdAt_id_idx"
    ON "AdminAuditLog"("action", "createdAt", "id");
CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx"
    ON "AdminAuditLog"("targetType", "targetId", "createdAt");

ALTER TABLE "LessonModerationCase"
    ADD CONSTRAINT "LessonModerationCase_lessonId_fkey"
        FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "LessonModerationCase_reviewedById_fkey"
        FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LessonReport"
    ADD CONSTRAINT "LessonReport_caseId_fkey"
        FOREIGN KEY ("caseId") REFERENCES "LessonModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "LessonReport_reporterId_fkey"
        FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "LessonReport_subjectStudentId_fkey"
        FOREIGN KEY ("subjectStudentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "LessonReport_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdminAuditLog"
    ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
        FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
