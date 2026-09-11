BEGIN;

CREATE TYPE "NotificationType" AS ENUM (
    'TEST_ASSIGNED',
    'TEST_AVAILABLE',
    'TEST_DUE_SOON',
    'TEST_OVERDUE',
    'TEST_REVIEW_REQUIRED',
    'TEST_GRADED',
    'TEST_NEEDS_REVISION',
    'BADGE_UNLOCKED',
    'LEVEL_UP'
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subjectStudentId" TEXT,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "deduplicationKey" VARCHAR(180) NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_recipientId_deduplicationKey_key"
    ON "Notification"("recipientId", "deduplicationKey");
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx"
    ON "Notification"("recipientId", "readAt", "createdAt");
CREATE INDEX "Notification_recipientId_createdAt_id_idx"
    ON "Notification"("recipientId", "createdAt", "id");
CREATE INDEX "Notification_subjectStudentId_idx"
    ON "Notification"("subjectStudentId");

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_recipientId_fkey"
        FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "Notification_subjectStudentId_fkey"
        FOREIGN KEY ("subjectStudentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
