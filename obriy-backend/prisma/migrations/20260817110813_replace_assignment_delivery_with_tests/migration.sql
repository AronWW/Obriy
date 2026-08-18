/*
  Warnings:

  - You are about to drop the column `attemptId` on the `AssignmentAttachment` table. All the data in the column will be lost.
  - You are about to drop the `AssignmentAttempt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssignmentRelease` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssignmentReviewEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssignmentStudentState` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LessonAssignment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AssignmentAttachment" DROP CONSTRAINT "AssignmentAttachment_attemptId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentAttempt" DROP CONSTRAINT "AssignmentAttempt_reviewedById_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentAttempt" DROP CONSTRAINT "AssignmentAttempt_revisionId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentAttempt" DROP CONSTRAINT "AssignmentAttempt_studentStateId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentRelease" DROP CONSTRAINT "AssignmentRelease_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentRelease" DROP CONSTRAINT "AssignmentRelease_classId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentRelease" DROP CONSTRAINT "AssignmentRelease_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentRelease" DROP CONSTRAINT "AssignmentRelease_revisionId_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentReviewEvent" DROP CONSTRAINT "AssignmentReviewEvent_attemptId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentReviewEvent" DROP CONSTRAINT "AssignmentReviewEvent_reviewerId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentStudentState" DROP CONSTRAINT "AssignmentStudentState_releaseId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentStudentState" DROP CONSTRAINT "AssignmentStudentState_studentId_fkey";

-- DropForeignKey
ALTER TABLE "LessonAssignment" DROP CONSTRAINT "LessonAssignment_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "LessonAssignment" DROP CONSTRAINT "LessonAssignment_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "LessonAssignment" DROP CONSTRAINT "LessonAssignment_revisionId_assignmentId_fkey";

-- DropIndex
DROP INDEX "AssignmentAttachment_attemptId_kind_idx";

-- AlterTable
ALTER TABLE "AssignmentAttachment" DROP COLUMN "attemptId",
ADD COLUMN     "testAnswerId" TEXT;

-- DropTable
DROP TABLE "AssignmentAttempt";

-- DropTable
DROP TABLE "AssignmentRelease";

-- DropTable
DROP TABLE "AssignmentReviewEvent";

-- DropTable
DROP TABLE "AssignmentStudentState";

-- DropTable
DROP TABLE "LessonAssignment";

-- DropEnum
DROP TYPE "AssignmentAttemptStatus";

-- DropEnum
DROP TYPE "AssignmentLatePolicy";

-- DropEnum
DROP TYPE "AssignmentReleaseStatus";

-- DropEnum
DROP TYPE "AssignmentReviewAction";

-- DropEnum
DROP TYPE "AssignmentScorePolicy";

-- DropEnum
DROP TYPE "AssignmentStudentStatus";

-- CreateIndex
CREATE INDEX "AssignmentAttachment_testAnswerId_kind_idx" ON "AssignmentAttachment"("testAnswerId", "kind");

-- AddForeignKey
ALTER TABLE "AssignmentAttachment" ADD CONSTRAINT "AssignmentAttachment_testAnswerId_fkey" FOREIGN KEY ("testAnswerId") REFERENCES "TestAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
