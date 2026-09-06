-- CreateEnum
CREATE TYPE "MapPresetBaseMapMode" AS ENUM ('STANDARD', 'NEUTRAL');

-- AlterTable
ALTER TABLE "MapPreset"
ADD COLUMN "baseMapMode" "MapPresetBaseMapMode" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "featureCount" INTEGER,
ADD COLUMN "fileSizeBytes" INTEGER,
ADD COLUMN "originalFileName" VARCHAR(255),
ADD COLUMN "periodLabel" VARCHAR(120),
ADD COLUMN "storageKey" VARCHAR(500),
ADD COLUMN "vertexCount" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "MapPreset_storageKey_key" ON "MapPreset"("storageKey");
