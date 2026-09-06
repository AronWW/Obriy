-- CreateTable
CREATE TABLE "MapDraft" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "sourcePresetId" TEXT,
    "name" VARCHAR(160) NOT NULL,
    "contentLocale" "Locale" NOT NULL,
    "periodLabel" VARCHAR(120),
    "attribution" TEXT NOT NULL DEFAULT '',
    "storageKey" VARCHAR(500),
    "originalFileName" VARCHAR(255),
    "fileSizeBytes" INTEGER,
    "featureCount" INTEGER NOT NULL DEFAULT 0,
    "vertexCount" INTEGER NOT NULL DEFAULT 0,
    "bounds" JSONB,
    "defaultViewport" JSONB,
    "editVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MapDraft_storageKey_key" ON "MapDraft"("storageKey");

-- CreateIndex
CREATE INDEX "MapDraft_teacherId_updatedAt_idx" ON "MapDraft"("teacherId", "updatedAt");

-- CreateIndex
CREATE INDEX "MapDraft_sourcePresetId_idx" ON "MapDraft"("sourcePresetId");

-- AddForeignKey
ALTER TABLE "MapDraft" ADD CONSTRAINT "MapDraft_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapDraft" ADD CONSTRAINT "MapDraft_sourcePresetId_fkey" FOREIGN KEY ("sourcePresetId") REFERENCES "MapPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
