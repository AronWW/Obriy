-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "contentLocale" "Locale" NOT NULL,
    "estimatedMinutes" INTEGER,
    "status" "LessonStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassLesson" (
    "classId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassLesson_pkey" PRIMARY KEY ("classId","lessonId")
);

-- CreateIndex
CREATE INDEX "Lesson_teacherId_status_updatedAt_idx" ON "Lesson"("teacherId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ClassLesson_lessonId_idx" ON "ClassLesson"("lessonId");

-- CreateIndex
CREATE INDEX "ClassLesson_classId_publishedAt_position_idx" ON "ClassLesson"("classId", "publishedAt", "position");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLesson" ADD CONSTRAINT "ClassLesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLesson" ADD CONSTRAINT "ClassLesson_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
