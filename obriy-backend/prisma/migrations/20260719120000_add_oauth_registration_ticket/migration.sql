CREATE TABLE "OAuthRegistrationTicket" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'uk',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthRegistrationTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthRegistrationTicket_tokenHash_key"
ON "OAuthRegistrationTicket"("tokenHash");
CREATE INDEX "OAuthRegistrationTicket_googleId_idx"
ON "OAuthRegistrationTicket"("googleId");
CREATE INDEX "OAuthRegistrationTicket_email_idx"
ON "OAuthRegistrationTicket"("email");
CREATE INDEX "OAuthRegistrationTicket_expiresAt_idx"
ON "OAuthRegistrationTicket"("expiresAt");
