-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TestRevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TestReleaseStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TestScorePolicy" AS ENUM ('BEST', 'LATEST');

-- CreateEnum
CREATE TYPE "TestLatePolicy" AS ENUM ('DISALLOW', 'ALLOW', 'ALLOW_WITH_PENALTY');

-- CreateEnum
CREATE TYPE "TestStudentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'AWAITING_REVIEW', 'NEEDS_REVISION', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TestAttemptStatus" AS ENUM ('IN_PROGRESS', 'AWAITING_REVIEW', 'GRADED', 'RETURNED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TestAnswerStatus" AS ENUM ('DRAFT', 'AWAITING_REVIEW', 'GRADED', 'RETURNED');

-- CreateEnum
CREATE TYPE "TestReviewAction" AS ENUM ('APPROVED', 'RETURNED', 'SCORE_OVERRIDDEN', 'COMMENT_UPDATED');

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "contentLocale" "Locale" NOT NULL,
    "status" "TestStatus" NOT NULL DEFAULT 'DRAFT',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRevision" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TestRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "instructions" TEXT,
    "passingPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "maxAttempts" INTEGER DEFAULT 1,
    "timeLimitSeconds" INTEGER,
    "scorePolicy" "TestScorePolicy" NOT NULL DEFAULT 'BEST',
    "shuffleItems" BOOLEAN NOT NULL DEFAULT false,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "editVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestItem" (
    "id" TEXT NOT NULL,
    "testRevisionId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "assignmentRevisionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "maxPoints" DECIMAL(8,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonTest" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "testRevisionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRelease" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "testRevisionId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "lessonId" TEXT,
    "status" "TestReleaseStatus" NOT NULL DEFAULT 'DRAFT',
    "maxPoints" DECIMAL(8,2) NOT NULL,
    "passingPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "availableFrom" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "timeLimitSeconds" INTEGER,
    "maxAttempts" INTEGER,
    "scorePolicy" "TestScorePolicy" NOT NULL DEFAULT 'BEST',
    "latePolicy" "TestLatePolicy" NOT NULL DEFAULT 'DISALLOW',
    "latePenaltyPercent" DECIMAL(5,2),
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestStudentState" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "TestStudentStatus" NOT NULL DEFAULT 'NOT_STARTED',
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

    CONSTRAINT "TestStudentState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAttempt" (
    "id" TEXT NOT NULL,
    "studentStateId" TEXT NOT NULL,
    "testRevisionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "clientAttemptId" VARCHAR(64) NOT NULL,
    "status" "TestAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "maxPoints" DECIMAL(8,2) NOT NULL,
    "scorePoints" DECIMAL(8,2),
    "scorePercent" DECIMAL(5,2),
    "isPassed" BOOLEAN,
    "pendingReviewCount" INTEGER NOT NULL DEFAULT 0,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAnswer" (
    "id" TEXT NOT NULL,
    "testAttemptId" TEXT NOT NULL,
    "testRevisionId" TEXT NOT NULL,
    "testItemId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "TestAnswerStatus" NOT NULL DEFAULT 'DRAFT',
    "responseData" JSONB,
    "gradingData" JSONB,
    "feedbackData" JSONB,
    "maxPoints" DECIMAL(8,2) NOT NULL,
    "scorePoints" DECIMAL(8,2),
    "scorePercent" DECIMAL(5,2),
    "isCorrect" BOOLEAN,
    "teacherComment" TEXT,
    "gradedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAnswerReviewEvent" (
    "id" TEXT NOT NULL,
    "testAnswerId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "action" "TestReviewAction" NOT NULL,
    "previousData" JSONB,
    "nextData" JSONB,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestAnswerReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Test_teacherId_status_updatedAt_idx" ON "Test"("teacherId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Test_teacherId_updatedAt_idx" ON "Test"("teacherId", "updatedAt");

-- CreateIndex
CREATE INDEX "TestRevision_testId_status_version_idx" ON "TestRevision"("testId", "status", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TestRevision_testId_version_key" ON "TestRevision"("testId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TestRevision_id_testId_key" ON "TestRevision"("id", "testId");

-- CreateIndex
CREATE INDEX "TestItem_assignmentId_idx" ON "TestItem"("assignmentId");

-- CreateIndex
CREATE INDEX "TestItem_assignmentRevisionId_idx" ON "TestItem"("assignmentRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "TestItem_testRevisionId_position_key" ON "TestItem"("testRevisionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TestItem_testRevisionId_assignmentId_key" ON "TestItem"("testRevisionId", "assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TestItem_id_testRevisionId_key" ON "TestItem"("id", "testRevisionId");

-- CreateIndex
CREATE INDEX "LessonTest_lessonId_position_idx" ON "LessonTest"("lessonId", "position");

-- CreateIndex
CREATE INDEX "LessonTest_testId_idx" ON "LessonTest"("testId");

-- CreateIndex
CREATE INDEX "LessonTest_testRevisionId_idx" ON "LessonTest"("testRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonTest_lessonId_testId_key" ON "LessonTest"("lessonId", "testId");

-- CreateIndex
CREATE INDEX "TestRelease_testId_status_createdAt_idx" ON "TestRelease"("testId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TestRelease_testRevisionId_idx" ON "TestRelease"("testRevisionId");

-- CreateIndex
CREATE INDEX "TestRelease_classId_status_availableFrom_dueAt_idx" ON "TestRelease"("classId", "status", "availableFrom", "dueAt");

-- CreateIndex
CREATE INDEX "TestRelease_lessonId_classId_status_idx" ON "TestRelease"("lessonId", "classId", "status");

-- CreateIndex
CREATE INDEX "TestStudentState_studentId_status_updatedAt_idx" ON "TestStudentState"("studentId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "TestStudentState_releaseId_status_completedAt_idx" ON "TestStudentState"("releaseId", "status", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestStudentState_releaseId_studentId_key" ON "TestStudentState"("releaseId", "studentId");

-- CreateIndex
CREATE INDEX "TestAttempt_testRevisionId_status_idx" ON "TestAttempt"("testRevisionId", "status");

-- CreateIndex
CREATE INDEX "TestAttempt_status_submittedAt_idx" ON "TestAttempt"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestAttempt_studentStateId_attemptNumber_key" ON "TestAttempt"("studentStateId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TestAttempt_studentStateId_clientAttemptId_key" ON "TestAttempt"("studentStateId", "clientAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "TestAttempt_id_testRevisionId_key" ON "TestAttempt"("id", "testRevisionId");

-- CreateIndex
CREATE INDEX "TestAnswer_testItemId_status_idx" ON "TestAnswer"("testItemId", "status");

-- CreateIndex
CREATE INDEX "TestAnswer_status_reviewedAt_idx" ON "TestAnswer"("status", "reviewedAt");

-- CreateIndex
CREATE INDEX "TestAnswer_reviewedById_idx" ON "TestAnswer"("reviewedById");

-- CreateIndex
CREATE UNIQUE INDEX "TestAnswer_testAttemptId_testItemId_key" ON "TestAnswer"("testAttemptId", "testItemId");

-- CreateIndex
CREATE INDEX "TestAnswerReviewEvent_testAnswerId_createdAt_idx" ON "TestAnswerReviewEvent"("testAnswerId", "createdAt");

-- CreateIndex
CREATE INDEX "TestAnswerReviewEvent_reviewerId_createdAt_idx" ON "TestAnswerReviewEvent"("reviewerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRevision" ADD CONSTRAINT "TestRevision_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestItem" ADD CONSTRAINT "TestItem_testRevisionId_fkey" FOREIGN KEY ("testRevisionId") REFERENCES "TestRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestItem" ADD CONSTRAINT "TestItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestItem" ADD CONSTRAINT "TestItem_assignmentRevisionId_assignmentId_fkey" FOREIGN KEY ("assignmentRevisionId", "assignmentId") REFERENCES "AssignmentRevision"("id", "assignmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTest" ADD CONSTRAINT "LessonTest_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTest" ADD CONSTRAINT "LessonTest_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTest" ADD CONSTRAINT "LessonTest_testRevisionId_testId_fkey" FOREIGN KEY ("testRevisionId", "testId") REFERENCES "TestRevision"("id", "testId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRelease" ADD CONSTRAINT "TestRelease_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRelease" ADD CONSTRAINT "TestRelease_testRevisionId_testId_fkey" FOREIGN KEY ("testRevisionId", "testId") REFERENCES "TestRevision"("id", "testId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRelease" ADD CONSTRAINT "TestRelease_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRelease" ADD CONSTRAINT "TestRelease_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestStudentState" ADD CONSTRAINT "TestStudentState_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "TestRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestStudentState" ADD CONSTRAINT "TestStudentState_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_studentStateId_fkey" FOREIGN KEY ("studentStateId") REFERENCES "TestStudentState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_testRevisionId_fkey" FOREIGN KEY ("testRevisionId") REFERENCES "TestRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAnswer" ADD CONSTRAINT "TestAnswer_testAttemptId_testRevisionId_fkey" FOREIGN KEY ("testAttemptId", "testRevisionId") REFERENCES "TestAttempt"("id", "testRevisionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAnswer" ADD CONSTRAINT "TestAnswer_testItemId_testRevisionId_fkey" FOREIGN KEY ("testItemId", "testRevisionId") REFERENCES "TestItem"("id", "testRevisionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAnswer" ADD CONSTRAINT "TestAnswer_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAnswerReviewEvent" ADD CONSTRAINT "TestAnswerReviewEvent_testAnswerId_fkey" FOREIGN KEY ("testAnswerId") REFERENCES "TestAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAnswerReviewEvent" ADD CONSTRAINT "TestAnswerReviewEvent_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
