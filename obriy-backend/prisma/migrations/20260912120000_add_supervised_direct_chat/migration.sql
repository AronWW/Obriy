ALTER TYPE "NotificationType" ADD VALUE 'CHAT_MESSAGE';

BEGIN;

CREATE TYPE "ChatAttachmentResourceType" AS ENUM ('IMAGE', 'RAW');

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherLastReadAt" TIMESTAMP(3),
    "studentLastReadAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "clientMessageId" VARCHAR(36) NOT NULL,
    "body" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Message_body_check" CHECK (
        "body" IS NULL OR char_length("body") BETWEEN 1 AND 4000
    ),
    CONSTRAINT "Message_editedAt_check" CHECK (
        "editedAt" IS NULL OR "editedAt" >= "createdAt"
    )
);

CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "storageKey" VARCHAR(255) NOT NULL,
    "resourceType" "ChatAttachmentResourceType" NOT NULL,
    "originalFileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MessageAttachment_sizeBytes_check" CHECK (
        "sizeBytes" BETWEEN 1 AND 20971520
    )
);

CREATE UNIQUE INDEX "Conversation_teacherId_studentId_key"
    ON "Conversation"("teacherId", "studentId");
CREATE INDEX "Conversation_teacherId_lastMessageAt_id_idx"
    ON "Conversation"("teacherId", "lastMessageAt", "id");
CREATE INDEX "Conversation_studentId_lastMessageAt_id_idx"
    ON "Conversation"("studentId", "lastMessageAt", "id");

CREATE UNIQUE INDEX "Message_senderId_clientMessageId_key"
    ON "Message"("senderId", "clientMessageId");
CREATE INDEX "Message_conversationId_createdAt_id_idx"
    ON "Message"("conversationId", "createdAt", "id");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

CREATE INDEX "MessageAttachment_messageId_idx"
    ON "MessageAttachment"("messageId");

ALTER TABLE "Conversation"
    ADD CONSTRAINT "Conversation_teacherId_fkey"
        FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "Conversation_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
    ADD CONSTRAINT "Message_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "Message_senderId_fkey"
        FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageAttachment"
    ADD CONSTRAINT "MessageAttachment_messageId_fkey"
        FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
