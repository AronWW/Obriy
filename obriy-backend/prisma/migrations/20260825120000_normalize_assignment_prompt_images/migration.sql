-- A prompt image is an independent media asset. Revisions reference it through
-- a dedicated relation so the same image can safely be reused by copied
-- assignments and by subsequent immutable revisions.
CREATE TABLE "AssignmentRevisionPromptImage" (
    "revisionId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentRevisionPromptImage_pkey" PRIMARY KEY ("revisionId")
);

-- Fail instead of silently losing an existing JSON reference if legacy data is
-- inconsistent with the attachment table.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "AssignmentRevision" AS revision
        WHERE revision."publicConfig" #>> '{promptImage,attachmentId}' IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM "AssignmentAttachment" AS attachment
              WHERE attachment."id" = revision."publicConfig" #>> '{promptImage,attachmentId}'
                AND attachment."kind" = 'PROMPT'
          )
    ) THEN
        RAISE EXCEPTION 'Cannot normalize prompt images: an assignment revision references a missing prompt attachment';
    END IF;
END $$;

INSERT INTO "AssignmentRevisionPromptImage" (
    "revisionId",
    "attachmentId",
    "createdAt"
)
SELECT
    revision."id",
    attachment."id",
    LEAST(revision."createdAt", attachment."createdAt")
FROM "AssignmentRevision" AS revision
JOIN "AssignmentAttachment" AS attachment
  ON attachment."id" = revision."publicConfig" #>> '{promptImage,attachmentId}'
 AND attachment."kind" = 'PROMPT';

ALTER TABLE "AssignmentAttachment"
    DROP CONSTRAINT "AssignmentAttachment_revisionId_fkey",
    DROP CONSTRAINT "AssignmentAttachment_parent_check",
    DROP CONSTRAINT "AssignmentAttachment_kind_check";

DROP INDEX "AssignmentAttachment_revisionId_kind_idx";

ALTER TABLE "AssignmentAttachment"
    DROP COLUMN "revisionId";

ALTER TABLE "AssignmentAttachment"
    ADD CONSTRAINT "AssignmentAttachment_parent_check"
    CHECK (
        ("kind" = 'PROMPT' AND "testAnswerId" IS NULL) OR
        ("kind" = 'RESPONSE' AND "testAnswerId" IS NOT NULL)
    );

CREATE INDEX "AssignmentRevisionPromptImage_attachmentId_idx"
    ON "AssignmentRevisionPromptImage"("attachmentId");

ALTER TABLE "AssignmentRevisionPromptImage"
    ADD CONSTRAINT "AssignmentRevisionPromptImage_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "AssignmentRevision"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentRevisionPromptImage"
    ADD CONSTRAINT "AssignmentRevisionPromptImage_attachmentId_fkey"
    FOREIGN KEY ("attachmentId") REFERENCES "AssignmentAttachment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
