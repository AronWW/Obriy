ALTER TYPE "AdminAuditAction" ADD VALUE 'SUSPENSION_APPEAL_APPROVED';
ALTER TYPE "AdminAuditAction" ADD VALUE 'SUSPENSION_APPEAL_REJECTED';
ALTER TYPE "AdminAuditTargetType" ADD VALUE 'SUSPENSION_APPEAL';

BEGIN;

CREATE TYPE "SuspensionAppealStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

CREATE TABLE "SuspensionAppeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "suspensionAuditLogId" TEXT NOT NULL,
    "status" "SuspensionAppealStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "resolutionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuspensionAppeal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SuspensionAppeal_message_check" CHECK (
        char_length(btrim("message")) BETWEEN 20 AND 2000
    ),
    CONSTRAINT "SuspensionAppeal_resolution_note_check" CHECK (
        "resolutionNote" IS NULL
        OR char_length(btrim("resolutionNote")) BETWEEN 10 AND 1000
    ),
    CONSTRAINT "SuspensionAppeal_resolution_state_check" CHECK (
        (
            "status" = 'PENDING'
            AND "reviewedAt" IS NULL
            AND "reviewedById" IS NULL
            AND "resolutionNote" IS NULL
        )
        OR
        (
            "status" IN ('APPROVED', 'REJECTED')
            AND "reviewedAt" IS NOT NULL
            AND "resolutionNote" IS NOT NULL
        )
    )
);

CREATE INDEX "SuspensionAppeal_userId_createdAt_id_idx"
    ON "SuspensionAppeal"("userId", "createdAt", "id");
CREATE INDEX "SuspensionAppeal_suspensionAuditLogId_createdAt_idx"
    ON "SuspensionAppeal"("suspensionAuditLogId", "createdAt");
CREATE INDEX "SuspensionAppeal_status_createdAt_id_idx"
    ON "SuspensionAppeal"("status", "createdAt", "id");
CREATE INDEX "SuspensionAppeal_reviewedById_reviewedAt_idx"
    ON "SuspensionAppeal"("reviewedById", "reviewedAt");

CREATE UNIQUE INDEX "SuspensionAppeal_one_pending_per_user_key"
    ON "SuspensionAppeal"("userId")
    WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "SuspensionAppeal_one_pending_per_suspension_key"
    ON "SuspensionAppeal"("suspensionAuditLogId")
    WHERE "status" = 'PENDING';

ALTER TABLE "SuspensionAppeal"
    ADD CONSTRAINT "SuspensionAppeal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SuspensionAppeal"
    ADD CONSTRAINT "SuspensionAppeal_suspensionAuditLogId_fkey"
    FOREIGN KEY ("suspensionAuditLogId") REFERENCES "AdminAuditLog"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SuspensionAppeal"
    ADD CONSTRAINT "SuspensionAppeal_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
