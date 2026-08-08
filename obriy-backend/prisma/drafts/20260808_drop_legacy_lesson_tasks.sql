-- DRAFT ONLY. DESTRUCTIVE. Do not execute without a separate explicit approval.
-- Preconditions:
--   1. All backend/frontend code uses AssignmentsModule.
--   2. Lesson progress no longer reads LessonTaskSubmission.
--   3. Development and test databases were checked/backed up as required.
-- This intentionally and permanently deletes every legacy task and submission.

BEGIN;

DROP TABLE "LessonTaskSubmission";
DROP TABLE "LessonTask";
DROP TYPE "LessonTaskSubmissionStatus";

COMMIT;
