-- CreateTable
CREATE TABLE "ParentInvitation" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentInvitation_tokenHash_key" ON "ParentInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "ParentInvitation_childId_idx" ON "ParentInvitation"("childId");

-- CreateIndex
CREATE INDEX "ParentInvitation_expiresAt_idx" ON "ParentInvitation"("expiresAt");

-- AddForeignKey
ALTER TABLE "ParentInvitation" ADD CONSTRAINT "ParentInvitation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
