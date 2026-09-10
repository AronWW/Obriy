BEGIN;

CREATE TYPE "XPSourceType" AS ENUM ('TEST_RELEASE_PASS');
CREATE TYPE "BadgeCriteriaType" AS ENUM ('PASSED_TEST_COUNT', 'PERFECT_SCORE_COUNT');

CREATE TABLE "XPLedger" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sourceType" "XPSourceType" NOT NULL,
    "sourceKey" VARCHAR(160) NOT NULL,
    "releaseId" TEXT,
    "attemptId" TEXT,
    "amount" INTEGER NOT NULL,
    "totalXpBefore" INTEGER NOT NULL,
    "totalXpAfter" INTEGER NOT NULL,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XPLedger_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "XPLedger_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "XPLedger_totals_check" CHECK (
        "totalXpBefore" >= 0 AND
        "totalXpAfter" = "totalXpBefore" + "amount"
    )
);

CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "iconKey" VARCHAR(80) NOT NULL,
    "criteriaType" "BadgeCriteriaType" NOT NULL,
    "criteriaValue" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Badge_criteriaValue_check" CHECK ("criteriaValue" > 0)
);

CREATE TABLE "BadgeTranslation" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(300) NOT NULL,

    CONSTRAINT "BadgeTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "sourceAttemptId" TEXT,
    "showcasePosition" INTEGER,
    "seenAt" TIMESTAMP(3),
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserBadge_showcasePosition_check" CHECK (
        "showcasePosition" IS NULL OR
        "showcasePosition" BETWEEN 1 AND 3
    )
);

CREATE UNIQUE INDEX "XPLedger_studentId_sourceType_sourceKey_key"
    ON "XPLedger"("studentId", "sourceType", "sourceKey");
CREATE INDEX "XPLedger_studentId_createdAt_idx" ON "XPLedger"("studentId", "createdAt");
CREATE INDEX "XPLedger_studentId_seenAt_idx" ON "XPLedger"("studentId", "seenAt");
CREATE INDEX "XPLedger_releaseId_idx" ON "XPLedger"("releaseId");
CREATE INDEX "XPLedger_attemptId_idx" ON "XPLedger"("attemptId");

CREATE UNIQUE INDEX "Badge_key_key" ON "Badge"("key");
CREATE INDEX "Badge_isActive_criteriaType_idx" ON "Badge"("isActive", "criteriaType");

CREATE UNIQUE INDEX "BadgeTranslation_badgeId_locale_key"
    ON "BadgeTranslation"("badgeId", "locale");
CREATE INDEX "BadgeTranslation_locale_idx" ON "BadgeTranslation"("locale");

CREATE UNIQUE INDEX "UserBadge_studentId_badgeId_key"
    ON "UserBadge"("studentId", "badgeId");
CREATE UNIQUE INDEX "UserBadge_studentId_showcasePosition_key"
    ON "UserBadge"("studentId", "showcasePosition");
CREATE INDEX "UserBadge_studentId_earnedAt_idx" ON "UserBadge"("studentId", "earnedAt");
CREATE INDEX "UserBadge_studentId_seenAt_idx" ON "UserBadge"("studentId", "seenAt");
CREATE INDEX "UserBadge_badgeId_idx" ON "UserBadge"("badgeId");
CREATE INDEX "UserBadge_sourceAttemptId_idx" ON "UserBadge"("sourceAttemptId");

ALTER TABLE "XPLedger"
    ADD CONSTRAINT "XPLedger_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "XPLedger_releaseId_fkey"
        FOREIGN KEY ("releaseId") REFERENCES "TestRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "XPLedger_attemptId_fkey"
        FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BadgeTranslation"
    ADD CONSTRAINT "BadgeTranslation_badgeId_fkey"
        FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBadge"
    ADD CONSTRAINT "UserBadge_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "UserBadge_badgeId_fkey"
        FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "UserBadge_sourceAttemptId_fkey"
        FOREIGN KEY ("sourceAttemptId") REFERENCES "TestAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
