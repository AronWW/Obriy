# Assignment migrations (drafts only)

These files are design artifacts for the new `AssignmentsModule`. They are kept
outside `prisma/migrations` so `prisma migrate deploy` cannot apply them by
accident.

Planned sequence:

1. The additive create script was reviewed and moved to the official Prisma
   migration `20260808120000_create_assignments_module`.
2. Implement and cut over the backend/frontend to `AssignmentsModule`.
3. Remove the legacy `LessonTask` models and code.
4. The destructive legacy cleanup was explicitly approved and promoted to the
   official migration `20260813200000_drop_legacy_lesson_tasks`.

No destructive migration drafts remain in this directory.
