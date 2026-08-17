-- The application has fully migrated to Assignment, AssignmentRelease,
-- AssignmentStudentState, and AssignmentAttempt. Legacy lesson tasks are no
-- longer read or written and their remaining data is intentionally removed.
DROP TABLE "LessonTaskSubmission";
DROP TABLE "LessonTask";
DROP TYPE "LessonTaskSubmissionStatus";
