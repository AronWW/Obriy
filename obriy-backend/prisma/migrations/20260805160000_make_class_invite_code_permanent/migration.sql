BEGIN;

LOCK TABLE "Class" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "Class" ADD COLUMN "inviteCode" VARCHAR(9);

DO $$
DECLARE
    class_record RECORD;
    alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    random_bytes BYTEA;
    character_index INTEGER;
    compact_code TEXT;
    formatted_code TEXT;
BEGIN
    FOR class_record IN SELECT "id" FROM "Class" ORDER BY "id" LOOP
        LOOP
            random_bytes := DECODE(
                MD5(class_record."id" || GEN_RANDOM_UUID()::TEXT),
                'hex'
            );
            compact_code := '';

            FOR character_index IN 0..7 LOOP
                compact_code := compact_code || SUBSTRING(
                    alphabet,
                    (GET_BYTE(random_bytes, character_index) % 32) + 1,
                    1
                );
            END LOOP;

            formatted_code := SUBSTRING(compact_code, 1, 4) || '-' || SUBSTRING(compact_code, 5, 4);

            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM "Class" WHERE "inviteCode" = formatted_code
            );
        END LOOP;

        UPDATE "Class"
        SET "inviteCode" = formatted_code
        WHERE "id" = class_record."id";
    END LOOP;
END $$;

ALTER TABLE "Class" ALTER COLUMN "inviteCode" SET NOT NULL;
CREATE UNIQUE INDEX "Class_inviteCode_key" ON "Class"("inviteCode");

DROP TABLE "ClassInvite";

COMMIT;
