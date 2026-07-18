CREATE TABLE "OAuthExchangeCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthExchangeCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthExchangeCode_tokenHash_key" ON "OAuthExchangeCode"("tokenHash");
CREATE INDEX "OAuthExchangeCode_userId_idx" ON "OAuthExchangeCode"("userId");
CREATE INDEX "OAuthExchangeCode_expiresAt_idx" ON "OAuthExchangeCode"("expiresAt");

ALTER TABLE "OAuthExchangeCode" ADD CONSTRAINT "OAuthExchangeCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
