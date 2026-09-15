ALTER TABLE "User"
    ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT "User_sessionVersion_check" CHECK ("sessionVersion" >= 0);

ALTER TABLE "Profile"
    ADD COLUMN "avatarStorageKey" VARCHAR(255),
    DROP COLUMN "gradeLevel";
