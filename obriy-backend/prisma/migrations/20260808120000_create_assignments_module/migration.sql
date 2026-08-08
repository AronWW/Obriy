-- Approved additive migration for the AssignmentsModule foundation.
-- Phase 1 is additive: the legacy LessonTask tables remain available while the
-- new AssignmentsModule is implemented and verified.

BEGIN;

CREATE TYPE "AssignmentType" AS ENUM (
    'WRITTEN',
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'MATCHING',
    'ORDERING',
    'CATEGORIZATION',
    'FILL_BLANKS',
    'IMAGE_HOTSPOT',
    'MAP_POINT',
    'MAP_REGION',
    'MAP_MULTI_REGION'
);

CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "AssignmentRevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "AssignmentReleaseStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'CLOSED', 'ARCHIVED');
CREATE TYPE "AssignmentScorePolicy" AS ENUM ('BEST', 'LATEST');
CREATE TYPE "AssignmentLatePolicy" AS ENUM ('DISALLOW', 'ALLOW', 'ALLOW_WITH_PENALTY');
CREATE TYPE "AssignmentStudentStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'AWAITING_REVIEW',
    'NEEDS_REVISION',
    'COMPLETED',
    'EXPIRED'
);
CREATE TYPE "AssignmentAttemptStatus" AS ENUM (
    'IN_PROGRESS',
    'AWAITING_REVIEW',
    'GRADED',
    'RETURNED',
    'EXPIRED',
    'CANCELLED'
);
CREATE TYPE "AssignmentAttachmentKind" AS ENUM ('PROMPT', 'RESPONSE');
CREATE TYPE "AssignmentAttachmentStatus" AS ENUM ('PENDING', 'READY', 'REJECTED', 'DELETED');
CREATE TYPE "AssignmentReviewAction" AS ENUM ('APPROVED', 'RETURNED', 'SCORE_OVERRIDDEN', 'COMMENT_UPDATED');
CREATE TYPE "MapPresetSourceType" AS ENUM ('BUILT_IN', 'CUSTOM_GEOJSON');
CREATE TYPE "MapPresetStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "type" "AssignmentType" NOT NULL,
    "contentLocale" "Locale" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "defaultMaxPoints" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "defaultPassingPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Assignment_defaultMaxPoints_check" CHECK ("defaultMaxPoints" > 0),
    CONSTRAINT "Assignment_defaultPassingPercent_check" CHECK (
        "defaultPassingPercent" >= 0 AND "defaultPassingPercent" <= 100
    )
);

CREATE TABLE "MapPreset" (
    "id" TEXT NOT NULL,
    "createdById" TEXT,
    "key" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "contentLocale" "Locale" NOT NULL,
    "sourceType" "MapPresetSourceType" NOT NULL,
    "status" "MapPresetStatus" NOT NULL DEFAULT 'ACTIVE',
    "geojsonUrl" VARCHAR(1000),
    "idProperty" VARCHAR(100),
    "year" INTEGER,
    "attribution" TEXT NOT NULL,
    "bounds" JSONB,
    "defaultViewport" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapPreset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentRevision" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "mapPresetId" TEXT,
    "version" INTEGER NOT NULL,
    "status" "AssignmentRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(160) NOT NULL,
    "prompt" TEXT NOT NULL,
    "instructions" TEXT,
    "explanation" TEXT,
    "publicConfig" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "editVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssignmentRevision_version_check" CHECK ("version" > 0),
    CONSTRAINT "AssignmentRevision_schemaVersion_check" CHECK ("schemaVersion" > 0),
    CONSTRAINT "AssignmentRevision_editVersion_check" CHECK ("editVersion" > 0)
);

CREATE TABLE "AssignmentSolution" (
    "revisionId" TEXT NOT NULL,
    "gradingConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentSolution_pkey" PRIMARY KEY ("revisionId")
);

CREATE TABLE "LessonAssignment" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentRelease" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "lessonId" TEXT,
    "status" "AssignmentReleaseStatus" NOT NULL DEFAULT 'DRAFT',
    "maxPoints" DECIMAL(8,2) NOT NULL,
    "passingPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "availableFrom" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "timeLimitSeconds" INTEGER,
    "maxAttempts" INTEGER,
    "scorePolicy" "AssignmentScorePolicy" NOT NULL DEFAULT 'BEST',
    "latePolicy" "AssignmentLatePolicy" NOT NULL DEFAULT 'DISALLOW',
    "latePenaltyPercent" DECIMAL(5,2),
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentRelease_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssignmentRelease_maxPoints_check" CHECK ("maxPoints" > 0),
    CONSTRAINT "AssignmentRelease_passingPercent_check" CHECK (
        "passingPercent" >= 0 AND "passingPercent" <= 100
    ),
    CONSTRAINT "AssignmentRelease_timeLimitSeconds_check" CHECK (
        "timeLimitSeconds" IS NULL OR "timeLimitSeconds" > 0
    ),
    CONSTRAINT "AssignmentRelease_maxAttempts_check" CHECK (
        "maxAttempts" IS NULL OR "maxAttempts" > 0
    ),
    CONSTRAINT "AssignmentRelease_xpReward_check" CHECK ("xpReward" >= 0),
    CONSTRAINT "AssignmentRelease_latePenaltyPercent_check" CHECK (
        "latePenaltyPercent" IS NULL OR
        ("latePenaltyPercent" >= 0 AND "latePenaltyPercent" <= 100)
    ),
    CONSTRAINT "AssignmentRelease_dates_check" CHECK (
        "availableFrom" IS NULL OR "dueAt" IS NULL OR "dueAt" > "availableFrom"
    )
);

CREATE TABLE "AssignmentStudentState" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AssignmentStudentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "scorePoints" DECIMAL(8,2),
    "scorePercent" DECIMAL(5,2),
    "bestPoints" DECIMAL(8,2),
    "bestPercent" DECIMAL(5,2),
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentStudentState_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssignmentStudentState_attemptCount_check" CHECK ("attemptCount" >= 0),
    CONSTRAINT "AssignmentStudentState_scores_check" CHECK (
        ("scorePoints" IS NULL OR "scorePoints" >= 0) AND
        ("bestPoints" IS NULL OR "bestPoints" >= 0) AND
        ("scorePercent" IS NULL OR ("scorePercent" >= 0 AND "scorePercent" <= 100)) AND
        ("bestPercent" IS NULL OR ("bestPercent" >= 0 AND "bestPercent" <= 100))
    )
);

CREATE TABLE "AssignmentAttempt" (
    "id" TEXT NOT NULL,
    "studentStateId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "attemptNumber" INTEGER NOT NULL,
    "clientAttemptId" VARCHAR(64) NOT NULL,
    "status" "AssignmentAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "responseData" JSONB,
    "gradingData" JSONB,
    "feedbackData" JSONB,
    "maxPoints" DECIMAL(8,2) NOT NULL,
    "scorePoints" DECIMAL(8,2),
    "scorePercent" DECIMAL(5,2),
    "isPassed" BOOLEAN,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "teacherComment" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssignmentAttempt_attemptNumber_check" CHECK ("attemptNumber" > 0),
    CONSTRAINT "AssignmentAttempt_maxPoints_check" CHECK ("maxPoints" > 0),
    CONSTRAINT "AssignmentAttempt_scores_check" CHECK (
        ("scorePoints" IS NULL OR "scorePoints" >= 0) AND
        ("scorePercent" IS NULL OR ("scorePercent" >= 0 AND "scorePercent" <= 100))
    ),
    CONSTRAINT "AssignmentAttempt_expiry_check" CHECK (
        "expiresAt" IS NULL OR "expiresAt" > "startedAt"
    )
);

CREATE TABLE "AssignmentAttachment" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT,
    "attemptId" TEXT,
    "uploadedById" TEXT,
    "kind" "AssignmentAttachmentKind" NOT NULL,
    "status" "AssignmentAttachmentStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" VARCHAR(500) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(127) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssignmentAttachment_sizeBytes_check" CHECK ("sizeBytes" >= 0),
    CONSTRAINT "AssignmentAttachment_parent_check" CHECK (
        num_nonnulls("revisionId", "attemptId") = 1
    ),
    CONSTRAINT "AssignmentAttachment_kind_check" CHECK (
        ("kind" = 'PROMPT' AND "revisionId" IS NOT NULL) OR
        ("kind" = 'RESPONSE' AND "attemptId" IS NOT NULL)
    )
);

CREATE TABLE "AssignmentReviewEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "action" "AssignmentReviewAction" NOT NULL,
    "previousData" JSONB,
    "nextData" JSONB,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentReviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Assignment_teacherId_status_updatedAt_idx"
    ON "Assignment"("teacherId", "status", "updatedAt");
CREATE INDEX "Assignment_teacherId_type_updatedAt_idx"
    ON "Assignment"("teacherId", "type", "updatedAt");

CREATE UNIQUE INDEX "MapPreset_key_key" ON "MapPreset"("key");
CREATE INDEX "MapPreset_createdById_status_updatedAt_idx"
    ON "MapPreset"("createdById", "status", "updatedAt");
CREATE INDEX "MapPreset_sourceType_status_idx"
    ON "MapPreset"("sourceType", "status");

CREATE INDEX "AssignmentRevision_assignmentId_status_version_idx"
    ON "AssignmentRevision"("assignmentId", "status", "version");
CREATE INDEX "AssignmentRevision_mapPresetId_idx"
    ON "AssignmentRevision"("mapPresetId");
CREATE UNIQUE INDEX "AssignmentRevision_assignmentId_version_key"
    ON "AssignmentRevision"("assignmentId", "version");
CREATE UNIQUE INDEX "AssignmentRevision_id_assignmentId_key"
    ON "AssignmentRevision"("id", "assignmentId");
CREATE UNIQUE INDEX "AssignmentRevision_one_draft_per_assignment_key"
    ON "AssignmentRevision"("assignmentId") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "AssignmentRevision_one_published_per_assignment_key"
    ON "AssignmentRevision"("assignmentId") WHERE "status" = 'PUBLISHED';

CREATE INDEX "LessonAssignment_assignmentId_idx"
    ON "LessonAssignment"("assignmentId");
CREATE INDEX "LessonAssignment_revisionId_idx"
    ON "LessonAssignment"("revisionId");
CREATE UNIQUE INDEX "LessonAssignment_lessonId_assignmentId_key"
    ON "LessonAssignment"("lessonId", "assignmentId");

CREATE INDEX "AssignmentRelease_assignmentId_status_createdAt_idx"
    ON "AssignmentRelease"("assignmentId", "status", "createdAt");
CREATE INDEX "AssignmentRelease_revisionId_idx"
    ON "AssignmentRelease"("revisionId");
CREATE INDEX "AssignmentRelease_classId_status_availableFrom_dueAt_idx"
    ON "AssignmentRelease"("classId", "status", "availableFrom", "dueAt");
CREATE INDEX "AssignmentRelease_lessonId_classId_status_idx"
    ON "AssignmentRelease"("lessonId", "classId", "status");
CREATE UNIQUE INDEX "AssignmentRelease_one_open_lesson_release_key"
    ON "AssignmentRelease"("classId", "lessonId", "assignmentId")
    WHERE "lessonId" IS NOT NULL
      AND "status" IN ('DRAFT', 'SCHEDULED', 'ACTIVE');

CREATE INDEX "AssignmentStudentState_studentId_status_updatedAt_idx"
    ON "AssignmentStudentState"("studentId", "status", "updatedAt");
CREATE INDEX "AssignmentStudentState_releaseId_status_completedAt_idx"
    ON "AssignmentStudentState"("releaseId", "status", "completedAt");
CREATE UNIQUE INDEX "AssignmentStudentState_releaseId_studentId_key"
    ON "AssignmentStudentState"("releaseId", "studentId");

CREATE INDEX "AssignmentAttempt_revisionId_status_idx"
    ON "AssignmentAttempt"("revisionId", "status");
CREATE INDEX "AssignmentAttempt_status_submittedAt_idx"
    ON "AssignmentAttempt"("status", "submittedAt");
CREATE INDEX "AssignmentAttempt_reviewedById_idx"
    ON "AssignmentAttempt"("reviewedById");
CREATE UNIQUE INDEX "AssignmentAttempt_studentStateId_attemptNumber_key"
    ON "AssignmentAttempt"("studentStateId", "attemptNumber");
CREATE UNIQUE INDEX "AssignmentAttempt_studentStateId_clientAttemptId_key"
    ON "AssignmentAttempt"("studentStateId", "clientAttemptId");

CREATE UNIQUE INDEX "AssignmentAttachment_storageKey_key"
    ON "AssignmentAttachment"("storageKey");
CREATE INDEX "AssignmentAttachment_revisionId_kind_idx"
    ON "AssignmentAttachment"("revisionId", "kind");
CREATE INDEX "AssignmentAttachment_attemptId_kind_idx"
    ON "AssignmentAttachment"("attemptId", "kind");
CREATE INDEX "AssignmentAttachment_uploadedById_idx"
    ON "AssignmentAttachment"("uploadedById");

CREATE INDEX "AssignmentReviewEvent_attemptId_createdAt_idx"
    ON "AssignmentReviewEvent"("attemptId", "createdAt");
CREATE INDEX "AssignmentReviewEvent_reviewerId_createdAt_idx"
    ON "AssignmentReviewEvent"("reviewerId", "createdAt");

ALTER TABLE "Assignment"
    ADD CONSTRAINT "Assignment_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MapPreset"
    ADD CONSTRAINT "MapPreset_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssignmentRevision"
    ADD CONSTRAINT "AssignmentRevision_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentRevision"
    ADD CONSTRAINT "AssignmentRevision_mapPresetId_fkey"
    FOREIGN KEY ("mapPresetId") REFERENCES "MapPreset"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssignmentSolution"
    ADD CONSTRAINT "AssignmentSolution_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "AssignmentRevision"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonAssignment"
    ADD CONSTRAINT "LessonAssignment_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonAssignment"
    ADD CONSTRAINT "LessonAssignment_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonAssignment"
    ADD CONSTRAINT "LessonAssignment_revisionId_assignmentId_fkey"
    FOREIGN KEY ("revisionId", "assignmentId")
    REFERENCES "AssignmentRevision"("id", "assignmentId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssignmentRelease"
    ADD CONSTRAINT "AssignmentRelease_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentRelease"
    ADD CONSTRAINT "AssignmentRelease_revisionId_assignmentId_fkey"
    FOREIGN KEY ("revisionId", "assignmentId")
    REFERENCES "AssignmentRevision"("id", "assignmentId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentRelease"
    ADD CONSTRAINT "AssignmentRelease_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "Class"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentRelease"
    ADD CONSTRAINT "AssignmentRelease_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssignmentStudentState"
    ADD CONSTRAINT "AssignmentStudentState_releaseId_fkey"
    FOREIGN KEY ("releaseId") REFERENCES "AssignmentRelease"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentStudentState"
    ADD CONSTRAINT "AssignmentStudentState_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentAttempt"
    ADD CONSTRAINT "AssignmentAttempt_studentStateId_fkey"
    FOREIGN KEY ("studentStateId") REFERENCES "AssignmentStudentState"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentAttempt"
    ADD CONSTRAINT "AssignmentAttempt_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "AssignmentRevision"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentAttempt"
    ADD CONSTRAINT "AssignmentAttempt_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssignmentAttachment"
    ADD CONSTRAINT "AssignmentAttachment_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "AssignmentRevision"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentAttachment"
    ADD CONSTRAINT "AssignmentAttachment_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "AssignmentAttempt"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentAttachment"
    ADD CONSTRAINT "AssignmentAttachment_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssignmentReviewEvent"
    ADD CONSTRAINT "AssignmentReviewEvent_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "AssignmentAttempt"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentReviewEvent"
    ADD CONSTRAINT "AssignmentReviewEvent_reviewerId_fkey"
    FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
