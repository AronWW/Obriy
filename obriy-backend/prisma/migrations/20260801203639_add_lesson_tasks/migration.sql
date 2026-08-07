-- CreateEnum
CREATE TYPE "LessonTaskSubmissionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'RETURNED');

-- CreateTable
CREATE TABLE "LessonTask" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "prompt" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonTaskSubmission" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "status" "LessonTaskSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "teacherComment" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonTaskSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonTask_lessonId_position_idx" ON "LessonTask"("lessonId", "position");

-- CreateIndex
CREATE INDEX "LessonTaskSubmission_taskId_status_idx" ON "LessonTaskSubmission"("taskId", "status");

-- CreateIndex
CREATE INDEX "LessonTaskSubmission_studentId_classId_status_idx" ON "LessonTaskSubmission"("studentId", "classId", "status");

-- CreateIndex
CREATE INDEX "LessonTaskSubmission_classId_status_submittedAt_idx" ON "LessonTaskSubmission"("classId", "status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LessonTaskSubmission_taskId_studentId_classId_key" ON "LessonTaskSubmission"("taskId", "studentId", "classId");

-- AddForeignKey
ALTER TABLE "LessonTask" ADD CONSTRAINT "LessonTask_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTaskSubmission" ADD CONSTRAINT "LessonTaskSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LessonTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTaskSubmission" ADD CONSTRAINT "LessonTaskSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTaskSubmission" ADD CONSTRAINT "LessonTaskSubmission_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
