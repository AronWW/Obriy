BEGIN;

-- Restore attachment invariants after replacing AssignmentAttempt with TestAnswer.
ALTER TABLE "AssignmentAttachment"
    ADD CONSTRAINT "AssignmentAttachment_parent_check"
        CHECK (num_nonnulls("revisionId", "testAnswerId") = 1),
    ADD CONSTRAINT "AssignmentAttachment_kind_check"
        CHECK (
            ("kind" = 'PROMPT' AND "revisionId" IS NOT NULL AND "testAnswerId" IS NULL) OR
            ("kind" = 'RESPONSE' AND "testAnswerId" IS NOT NULL AND "revisionId" IS NULL)
        );

ALTER TABLE "TestRevision"
    ADD CONSTRAINT "TestRevision_version_check" CHECK ("version" > 0),
    ADD CONSTRAINT "TestRevision_passingPercent_check"
        CHECK ("passingPercent" >= 0 AND "passingPercent" <= 100),
    ADD CONSTRAINT "TestRevision_maxAttempts_check"
        CHECK ("maxAttempts" IS NULL OR "maxAttempts" > 0),
    ADD CONSTRAINT "TestRevision_timeLimitSeconds_check"
        CHECK ("timeLimitSeconds" IS NULL OR "timeLimitSeconds" > 0),
    ADD CONSTRAINT "TestRevision_schemaVersion_check" CHECK ("schemaVersion" > 0),
    ADD CONSTRAINT "TestRevision_editVersion_check" CHECK ("editVersion" > 0);

ALTER TABLE "TestItem"
    ADD CONSTRAINT "TestItem_position_check" CHECK ("position" >= 0),
    ADD CONSTRAINT "TestItem_maxPoints_check" CHECK ("maxPoints" > 0);

ALTER TABLE "LessonTest"
    ADD CONSTRAINT "LessonTest_position_check" CHECK ("position" >= 0);

ALTER TABLE "TestRelease"
    ADD CONSTRAINT "TestRelease_maxPoints_check" CHECK ("maxPoints" > 0),
    ADD CONSTRAINT "TestRelease_passingPercent_check"
        CHECK ("passingPercent" >= 0 AND "passingPercent" <= 100),
    ADD CONSTRAINT "TestRelease_timeLimitSeconds_check"
        CHECK ("timeLimitSeconds" IS NULL OR "timeLimitSeconds" > 0),
    ADD CONSTRAINT "TestRelease_maxAttempts_check"
        CHECK ("maxAttempts" IS NULL OR "maxAttempts" > 0),
    ADD CONSTRAINT "TestRelease_xpReward_check" CHECK ("xpReward" >= 0),
    ADD CONSTRAINT "TestRelease_latePenaltyPercent_check"
        CHECK (
            "latePenaltyPercent" IS NULL OR
            ("latePenaltyPercent" >= 0 AND "latePenaltyPercent" <= 100)
        ),
    ADD CONSTRAINT "TestRelease_latePolicy_check"
        CHECK (
            ("latePolicy" = 'ALLOW_WITH_PENALTY' AND "latePenaltyPercent" IS NOT NULL) OR
            ("latePolicy" <> 'ALLOW_WITH_PENALTY' AND "latePenaltyPercent" IS NULL)
        ),
    ADD CONSTRAINT "TestRelease_dates_check"
        CHECK ("availableFrom" IS NULL OR "dueAt" IS NULL OR "dueAt" > "availableFrom");

ALTER TABLE "TestStudentState"
    ADD CONSTRAINT "TestStudentState_attemptCount_check" CHECK ("attemptCount" >= 0),
    ADD CONSTRAINT "TestStudentState_scores_check"
        CHECK (
            ("scorePoints" IS NULL OR "scorePoints" >= 0) AND
            ("bestPoints" IS NULL OR "bestPoints" >= 0) AND
            ("scorePercent" IS NULL OR ("scorePercent" >= 0 AND "scorePercent" <= 100)) AND
            ("bestPercent" IS NULL OR ("bestPercent" >= 0 AND "bestPercent" <= 100))
        );

ALTER TABLE "TestAttempt"
    ADD CONSTRAINT "TestAttempt_attemptNumber_check" CHECK ("attemptNumber" > 0),
    ADD CONSTRAINT "TestAttempt_maxPoints_check" CHECK ("maxPoints" > 0),
    ADD CONSTRAINT "TestAttempt_scores_check"
        CHECK (
            ("scorePoints" IS NULL OR ("scorePoints" >= 0 AND "scorePoints" <= "maxPoints")) AND
            ("scorePercent" IS NULL OR ("scorePercent" >= 0 AND "scorePercent" <= 100))
        ),
    ADD CONSTRAINT "TestAttempt_pendingReviewCount_check" CHECK ("pendingReviewCount" >= 0),
    ADD CONSTRAINT "TestAttempt_expiry_check"
        CHECK ("expiresAt" IS NULL OR "expiresAt" > "startedAt");

ALTER TABLE "TestAnswer"
    ADD CONSTRAINT "TestAnswer_maxPoints_check" CHECK ("maxPoints" > 0),
    ADD CONSTRAINT "TestAnswer_scores_check"
        CHECK (
            ("scorePoints" IS NULL OR ("scorePoints" >= 0 AND "scorePoints" <= "maxPoints")) AND
            ("scorePercent" IS NULL OR ("scorePercent" >= 0 AND "scorePercent" <= 100))
        );

-- PostgreSQL partial indexes enforce the single mutable/current row rules that
-- cannot be represented by Prisma's schema language.
CREATE UNIQUE INDEX "TestRevision_one_draft_per_test_idx"
    ON "TestRevision" ("testId")
    WHERE "status" = 'DRAFT';

CREATE UNIQUE INDEX "TestRevision_one_published_per_test_idx"
    ON "TestRevision" ("testId")
    WHERE "status" = 'PUBLISHED';

CREATE UNIQUE INDEX "TestRelease_one_open_lesson_release_idx"
    ON "TestRelease" ("classId", "lessonId", "testId")
    WHERE "lessonId" IS NOT NULL AND "status" IN ('DRAFT', 'SCHEDULED', 'ACTIVE');

-- A TestAttempt must always use the exact revision pinned by its release.
CREATE FUNCTION "assert_test_attempt_release_revision"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "TestStudentState" state
        JOIN "TestRelease" release ON release."id" = state."releaseId"
        WHERE state."id" = NEW."studentStateId"
          AND release."testRevisionId" = NEW."testRevisionId"
    ) THEN
        RAISE EXCEPTION 'TestAttempt revision must match its release revision'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "TestAttempt_release_revision_check"
    BEFORE INSERT OR UPDATE OF "studentStateId", "testRevisionId"
    ON "TestAttempt"
    FOR EACH ROW
    EXECUTE FUNCTION "assert_test_attempt_release_revision"();

CREATE FUNCTION "prevent_test_release_revision_mismatch"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."testRevisionId" IS DISTINCT FROM OLD."testRevisionId" AND EXISTS (
        SELECT 1
        FROM "TestStudentState" state
        JOIN "TestAttempt" attempt ON attempt."studentStateId" = state."id"
        WHERE state."releaseId" = OLD."id"
          AND attempt."testRevisionId" <> NEW."testRevisionId"
    ) THEN
        RAISE EXCEPTION 'TestRelease revision cannot diverge from existing attempts'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "TestRelease_attempt_revision_check"
    BEFORE UPDATE OF "testRevisionId"
    ON "TestRelease"
    FOR EACH ROW
    EXECUTE FUNCTION "prevent_test_release_revision_mismatch"();

COMMIT;
