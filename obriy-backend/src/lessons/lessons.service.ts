import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  LessonStatus,
  Prisma,
  TestAttemptStatus,
  TestLatePolicy,
  TestReleaseStatus,
  TestStudentStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateLessonDto } from './dto/create-lesson.dto';
import {
  ClassLessonItemDto,
  LessonClassLinkDto,
  LessonDetailDto,
  LessonSummaryDto,
  StudentLessonClassDto,
  StudentLessonDetailDto,
  StudentLessonSummaryDto,
  StudentLessonTeacherDto,
} from './dto/lesson.dto';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto';
import {
  StudentLessonProgressDto,
  StudentLessonProgressStatus,
} from './dto/student-lesson-progress.dto';
import { ClassLessonMoveDirection } from './dto/move-class-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

const lessonInclude = {
  classLinks: {
    orderBy: [{ position: 'asc' }, { classId: 'asc' }],
    include: {
      class: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.LessonInclude;

const lessonSummarySelect = {
  id: true,
  title: true,
  summary: true,
  contentLocale: true,
  estimatedMinutes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  classLinks: lessonInclude.classLinks,
} satisfies Prisma.LessonSelect;

const classLessonSelect = {
  classId: true,
  lessonId: true,
  position: true,
  publishedAt: true,
  lesson: {
    select: {
      id: true,
      title: true,
      summary: true,
      contentLocale: true,
      estimatedMinutes: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ClassLessonSelect;

const studentLessonSummarySelect = {
  lessonId: true,
  position: true,
  lesson: {
    select: {
      id: true,
      title: true,
      summary: true,
      contentLocale: true,
      estimatedMinutes: true,
    },
  },
} satisfies Prisma.ClassLessonSelect;

const studentLessonDetailSelect = {
  position: true,
  class: {
    select: {
      id: true,
      name: true,
    },
  },
  lesson: {
    select: {
      id: true,
      title: true,
      summary: true,
      content: true,
      contentLocale: true,
      estimatedMinutes: true,
      teacher: {
        select: {
          id: true,
          profile: {
            select: { displayName: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ClassLessonSelect;

type LessonRecord = Prisma.LessonGetPayload<{ include: typeof lessonInclude }>;
type LessonSummaryRecord = Prisma.LessonGetPayload<{
  select: typeof lessonSummarySelect;
}>;
type ClassLessonRecord = Prisma.ClassLessonGetPayload<{
  select: typeof classLessonSelect;
}>;
type StudentLessonSummaryRecord = Prisma.ClassLessonGetPayload<{
  select: typeof studentLessonSummarySelect;
}>;
type StudentLessonDetailRecord = Prisma.ClassLessonGetPayload<{
  select: typeof studentLessonDetailSelect;
}>;

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLesson(
    user: AuthUser,
    dto: CreateLessonDto,
  ): Promise<LessonDetailDto> {
    this.assertTeacher(user);
    this.assertMeaningfulDraft(dto);

    const teacher = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        profile: { select: { preferredLocale: true } },
      },
    });

    if (!teacher?.profile) {
      throw new NotFoundException({
        code: 'TEACHER_PROFILE_NOT_FOUND',
        message: 'Teacher profile not found',
      });
    }

    const lesson = await this.prisma.lesson.create({
      data: {
        teacherId: user.id,
        title: dto.title?.trim() ?? '',
        summary: dto.summary?.trim() ?? '',
        content: dto.content ?? '',
        contentLocale: dto.contentLocale ?? teacher.profile.preferredLocale,
        estimatedMinutes: dto.estimatedMinutes ?? null,
      },
      include: lessonInclude,
    });

    return this.toLessonDetailDto(lesson);
  }

  async listMyLessons(
    user: AuthUser,
    query: ListLessonsQueryDto,
  ): Promise<LessonSummaryDto[]> {
    this.assertTeacher(user);
    const search = query.search?.trim();

    const lessons = await this.prisma.lesson.findMany({
      where: {
        teacherId: user.id,
        status: query.status,
        ...(search
          ? { title: { contains: search, mode: Prisma.QueryMode.insensitive } }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: lessonSummarySelect,
    });

    return lessons.map((lesson) => this.toLessonSummaryDto(lesson));
  }

  async findMyLesson(
    user: AuthUser,
    lessonId: string,
  ): Promise<LessonDetailDto> {
    this.assertTeacher(user);
    const lesson = await this.findOwnedLesson(user.id, lessonId);
    return this.toLessonDetailDto(lesson);
  }

  async updateMyLesson(
    user: AuthUser,
    lessonId: string,
    dto: UpdateLessonDto,
  ): Promise<LessonDetailDto> {
    this.assertTeacher(user);
    const lesson = await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      const existing = await transaction.lesson.findUnique({
        where: { id: lessonId },
        include: lessonInclude,
      });

      if (!existing) {
        throw this.lessonNotFound();
      }

      if (existing.status === LessonStatus.ARCHIVED) {
        throw new ConflictException({
          code: 'LESSON_ARCHIVED',
          message: 'Restore the lesson before editing it',
        });
      }

      if (existing.status === LessonStatus.PUBLISHED) {
        this.assertLessonComplete({
          title: dto.title ?? existing.title,
          summary: dto.summary ?? existing.summary,
          content: dto.content ?? existing.content,
        });
      }

      return transaction.lesson.update({
        where: { id: existing.id },
        data: {
          title: dto.title?.trim(),
          summary: dto.summary?.trim(),
          content: dto.content,
          contentLocale: dto.contentLocale,
          estimatedMinutes: dto.estimatedMinutes,
        },
        include: lessonInclude,
      });
    });

    return this.toLessonDetailDto(lesson);
  }

  async deleteMyLesson(user: AuthUser, lessonId: string): Promise<void> {
    this.assertTeacher(user);

    await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      const lesson = await transaction.lesson.findUnique({
        where: { id: lessonId },
        select: {
          id: true,
          status: true,
          _count: { select: { classLinks: true } },
        },
      });

      if (!lesson) {
        throw this.lessonNotFound();
      }

      if (
        lesson.status !== LessonStatus.DRAFT ||
        lesson._count.classLinks > 0
      ) {
        throw new ConflictException({
          code: 'LESSON_DELETE_NOT_ALLOWED',
          message: 'Only an unassigned draft lesson can be deleted',
        });
      }

      await transaction.lesson.delete({ where: { id: lesson.id } });
    });
  }

  async archiveMyLesson(
    user: AuthUser,
    lessonId: string,
  ): Promise<LessonDetailDto> {
    this.assertTeacher(user);

    const lesson = await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      const existing = await transaction.lesson.findUnique({
        where: { id: lessonId },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw this.lessonNotFound();
      }

      if (existing.status !== LessonStatus.ARCHIVED) {
        await transaction.classLesson.updateMany({
          where: { lessonId: existing.id, publishedAt: { not: null } },
          data: { publishedAt: null },
        });
        await transaction.lesson.update({
          where: { id: existing.id },
          data: { status: LessonStatus.ARCHIVED },
        });
        await this.archiveLessonTestReleases(transaction, existing.id);
      }

      return transaction.lesson.findUnique({
        where: { id: existing.id },
        include: lessonInclude,
      });
    });

    if (!lesson) {
      throw new InternalServerErrorException('Archived lesson is unavailable');
    }

    return this.toLessonDetailDto(lesson);
  }

  async restoreMyLesson(
    user: AuthUser,
    lessonId: string,
  ): Promise<LessonDetailDto> {
    this.assertTeacher(user);
    const lesson = await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      const existing = await transaction.lesson.findUnique({
        where: { id: lessonId },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw this.lessonNotFound();
      }

      if (existing.status !== LessonStatus.ARCHIVED) {
        throw new ConflictException({
          code: 'LESSON_NOT_ARCHIVED',
          message: 'Only an archived lesson can be restored',
        });
      }

      return transaction.lesson.update({
        where: { id: existing.id },
        data: { status: LessonStatus.DRAFT },
        include: lessonInclude,
      });
    });

    return this.toLessonDetailDto(lesson);
  }

  async listMyStudentLessons(
    user: AuthUser,
  ): Promise<StudentLessonSummaryDto[]> {
    this.assertStudent(user);
    const classId = await this.findStudentClassId(user.id);

    if (!classId) {
      return [];
    }

    const links = await this.prisma.classLesson.findMany({
      where: {
        classId,
        publishedAt: { not: null },
        lesson: { status: LessonStatus.PUBLISHED },
      },
      orderBy: [{ position: 'asc' }, { lessonId: 'asc' }],
      select: studentLessonSummarySelect,
    });

    const progressByLesson = await this.findStudentProgressByLesson(
      user.id,
      classId,
      links.map((link) => link.lessonId),
    );

    return links.map((link) =>
      this.toStudentLessonSummaryDto(
        link,
        progressByLesson.get(link.lessonId) ?? this.emptyStudentProgress(),
      ),
    );
  }

  async findMyStudentLesson(
    user: AuthUser,
    lessonId: string,
  ): Promise<StudentLessonDetailDto> {
    this.assertStudent(user);
    const classId = await this.findStudentClassId(user.id);

    if (!classId) {
      throw this.lessonNotFound();
    }

    const link = await this.prisma.classLesson.findFirst({
      where: {
        classId,
        lessonId,
        publishedAt: { not: null },
        lesson: { status: LessonStatus.PUBLISHED },
      },
      select: studentLessonDetailSelect,
    });

    if (!link) {
      throw this.lessonNotFound();
    }

    const progressByLesson = await this.findStudentProgressByLesson(
      user.id,
      classId,
      [lessonId],
    );

    return this.toStudentLessonDetailDto(
      link,
      progressByLesson.get(lessonId) ?? this.emptyStudentProgress(),
    );
  }

  async listClassLessons(
    user: AuthUser,
    classId: string,
  ): Promise<ClassLessonItemDto[]> {
    this.assertTeacher(user);
    await this.assertOwnedClass(this.prisma, user.id, classId);

    const links = await this.prisma.classLesson.findMany({
      where: { classId, lesson: { teacherId: user.id } },
      orderBy: [{ position: 'asc' }, { lessonId: 'asc' }],
      select: classLessonSelect,
    });

    return links.map((link) => this.toClassLessonItemDto(link));
  }

  async setClassLesson(
    user: AuthUser,
    classId: string,
    lessonId: string,
    published: boolean,
  ): Promise<ClassLessonItemDto> {
    this.assertTeacher(user);

    const link = await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedClass(transaction, user.id, classId);
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      const lesson = await transaction.lesson.findUnique({
        where: { id: lessonId },
        select: {
          id: true,
          title: true,
          summary: true,
          content: true,
          status: true,
        },
      });

      if (!lesson) {
        throw this.lessonNotFound();
      }

      if (lesson.status === LessonStatus.ARCHIVED) {
        throw new ConflictException({
          code: 'LESSON_ARCHIVED',
          message: 'An archived lesson cannot be assigned or published',
        });
      }

      if (published) {
        this.assertLessonComplete(lesson);
      }

      const where = { classId_lessonId: { classId, lessonId } };
      const existing = await transaction.classLesson.findUnique({
        where,
        select: { classId: true, lessonId: true, publishedAt: true },
      });

      if (!existing) {
        const positions = await transaction.classLesson.aggregate({
          where: { classId },
          _max: { position: true },
        });

        await transaction.classLesson.create({
          data: {
            classId,
            lessonId,
            position: (positions._max.position ?? 0) + 1,
            publishedAt: published ? new Date() : null,
          },
        });
      } else if (published !== Boolean(existing.publishedAt)) {
        await transaction.classLesson.update({
          where,
          data: { publishedAt: published ? new Date() : null },
        });
      }

      if (published && lesson.status === LessonStatus.DRAFT) {
        await transaction.lesson.update({
          where: { id: lesson.id },
          data: { status: LessonStatus.PUBLISHED },
        });
      }

      if (published) {
        await this.activateLessonTestReleases(transaction, classId, lessonId);
      } else {
        await this.archiveLessonTestReleases(transaction, lessonId, classId);
      }

      return transaction.classLesson.findUnique({
        where,
        select: classLessonSelect,
      });
    });

    if (!link) {
      throw new InternalServerErrorException(
        'Assigned class lesson is unavailable',
      );
    }

    return this.toClassLessonItemDto(link);
  }

  async unlinkClassLesson(
    user: AuthUser,
    classId: string,
    lessonId: string,
  ): Promise<void> {
    this.assertTeacher(user);

    await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedClass(transaction, user.id, classId);
      await this.lockOwnedLesson(transaction, user.id, lessonId);

      const result = await transaction.classLesson.deleteMany({
        where: { classId, lessonId },
      });

      if (result.count !== 1) {
        throw this.classLessonNotFound();
      }

      await this.archiveLessonTestReleases(transaction, lessonId, classId);
    });
  }

  async moveClassLesson(
    user: AuthUser,
    classId: string,
    lessonId: string,
    direction: ClassLessonMoveDirection,
  ): Promise<ClassLessonItemDto[]> {
    this.assertTeacher(user);

    const links = await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedClass(transaction, user.id, classId);
      await this.lockOwnedLesson(transaction, user.id, lessonId);

      const orderedLinks = await transaction.classLesson.findMany({
        where: { classId },
        orderBy: [{ position: 'asc' }, { lessonId: 'asc' }],
        select: { classId: true, lessonId: true, position: true },
      });

      const currentIndex = orderedLinks.findIndex(
        (link) => link.lessonId === lessonId,
      );
      if (currentIndex === -1) {
        throw this.classLessonNotFound();
      }

      const targetIndex =
        direction === ClassLessonMoveDirection.UP
          ? currentIndex - 1
          : currentIndex + 1;
      if (targetIndex >= 0 && targetIndex < orderedLinks.length) {
        [orderedLinks[currentIndex], orderedLinks[targetIndex]] = [
          orderedLinks[targetIndex],
          orderedLinks[currentIndex],
        ];
      }

      // Re-numbering also repairs any legacy gaps or duplicate positions. The
      // class row lock serializes all assignment and reorder operations.
      for (const [index, link] of orderedLinks.entries()) {
        const position = index + 1;
        if (link.position !== position) {
          await transaction.classLesson.update({
            where: {
              classId_lessonId: {
                classId: link.classId,
                lessonId: link.lessonId,
              },
            },
            data: { position },
          });
        }
      }

      return transaction.classLesson.findMany({
        where: { classId, lesson: { teacherId: user.id } },
        orderBy: [{ position: 'asc' }, { lessonId: 'asc' }],
        select: classLessonSelect,
      });
    });

    return links.map((link) => this.toClassLessonItemDto(link));
  }

  private async findOwnedLesson(
    teacherId: string,
    lessonId: string,
  ): Promise<LessonRecord> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, teacherId },
      include: lessonInclude,
    });

    if (!lesson) {
      throw this.lessonNotFound();
    }

    return lesson;
  }

  private async findStudentClassId(userId: string): Promise<string | null> {
    const student = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { studentClassId: true },
    });

    return student?.studentClassId ?? null;
  }

  private async findStudentProgressByLesson(
    studentId: string,
    classId: string,
    lessonIds: string[],
  ): Promise<Map<string, StudentLessonProgressDto>> {
    const result = new Map<string, StudentLessonProgressDto>();

    if (lessonIds.length === 0) {
      return result;
    }

    const releases = await this.prisma.testRelease.findMany({
      where: {
        lessonId: { in: lessonIds },
        classId,
        status: TestReleaseStatus.ACTIVE,
        isRequired: true,
      },
      select: {
        lessonId: true,
        dueAt: true,
        latePolicy: true,
        studentStates: {
          where: { studentId },
          take: 1,
          select: { status: true },
        },
      },
    });

    const now = new Date();
    for (const lessonId of lessonIds) {
      const lessonReleases = releases
        .filter((release) => release.lessonId === lessonId)
        .map((release) => ({
          status: this.resolveProgressStatus(
            release.studentStates[0]?.status,
            release.dueAt,
            release.latePolicy,
            now,
          ),
        }));
      result.set(lessonId, this.calculateStudentProgress(lessonReleases));
    }

    return result;
  }

  private calculateStudentProgress(
    tests: { status: TestStudentStatus }[],
  ): StudentLessonProgressDto {
    const requiredTotal = tests.length;
    const completed = tests.filter(
      (test) => test.status === TestStudentStatus.COMPLETED,
    ).length;
    const awaitingReview = tests.filter(
      (test) => test.status === TestStudentStatus.AWAITING_REVIEW,
    ).length;
    const needsRevision = tests.filter(
      (test) => test.status === TestStudentStatus.NEEDS_REVISION,
    ).length;
    const inProgress = tests.filter(
      (test) => test.status === TestStudentStatus.IN_PROGRESS,
    ).length;
    const expired = tests.filter(
      (test) => test.status === TestStudentStatus.EXPIRED,
    ).length;

    let status = StudentLessonProgressStatus.IN_PROGRESS;
    if (requiredTotal === 0) {
      status = StudentLessonProgressStatus.NO_TASKS;
    } else if (completed === requiredTotal) {
      status = StudentLessonProgressStatus.COMPLETED;
    } else if (
      completed + awaitingReview + needsRevision + inProgress + expired ===
      0
    ) {
      status = StudentLessonProgressStatus.NOT_STARTED;
    }

    return new StudentLessonProgressDto({
      status,
      requiredTotal,
      completed,
      awaitingReview,
      needsRevision,
      inProgress,
      expired,
    });
  }

  private resolveProgressStatus(
    persistedStatus: TestStudentStatus | undefined,
    dueAt: Date | null,
    latePolicy: TestLatePolicy,
    now: Date,
  ): TestStudentStatus {
    const status = persistedStatus ?? TestStudentStatus.NOT_STARTED;
    if (
      status !== TestStudentStatus.AWAITING_REVIEW &&
      status !== TestStudentStatus.COMPLETED &&
      dueAt &&
      dueAt < now &&
      latePolicy === TestLatePolicy.DISALLOW
    ) {
      return TestStudentStatus.EXPIRED;
    }
    return status;
  }

  private emptyStudentProgress(): StudentLessonProgressDto {
    return this.calculateStudentProgress([]);
  }

  private async activateLessonTestReleases(
    transaction: Prisma.TransactionClient,
    classId: string,
    lessonId: string,
  ): Promise<void> {
    const links = await transaction.lessonTest.findMany({
      where: { lessonId },
      select: {
        testId: true,
        testRevisionId: true,
        revision: {
          select: {
            passingPercent: true,
            maxAttempts: true,
            timeLimitSeconds: true,
            scorePolicy: true,
            items: { select: { maxPoints: true } },
          },
        },
      },
    });
    if (links.length === 0) {
      return;
    }

    const existing = await transaction.testRelease.findMany({
      where: {
        classId,
        lessonId,
        testId: { in: links.map((link) => link.testId) },
        status: {
          in: [
            TestReleaseStatus.DRAFT,
            TestReleaseStatus.SCHEDULED,
            TestReleaseStatus.ACTIVE,
          ],
        },
      },
      select: { testId: true },
    });
    const releasedTestIds = new Set(existing.map((release) => release.testId));
    const publishedAt = new Date();
    const releaseData = links
      .filter((link) => !releasedTestIds.has(link.testId))
      .map((link) => ({
        testId: link.testId,
        testRevisionId: link.testRevisionId,
        classId,
        lessonId,
        status: TestReleaseStatus.ACTIVE,
        maxPoints: link.revision.items.reduce(
          (sum, item) => sum + Number(item.maxPoints),
          0,
        ),
        passingPercent: link.revision.passingPercent,
        isRequired: true,
        timeLimitSeconds: link.revision.timeLimitSeconds,
        maxAttempts: link.revision.maxAttempts,
        scorePolicy: link.revision.scorePolicy,
        publishedAt,
      }));
    if (releaseData.length === 0) {
      return;
    }
    await transaction.testRelease.createMany({ data: releaseData });
  }

  private async archiveLessonTestReleases(
    transaction: Prisma.TransactionClient,
    lessonId: string,
    classId?: string,
  ): Promise<void> {
    await this.lockLessonTestReleases(transaction, lessonId, classId);
    const cancelledAt = new Date();
    await transaction.testAttempt.updateMany({
      where: {
        status: TestAttemptStatus.IN_PROGRESS,
        studentState: {
          release: {
            lessonId,
            ...(classId ? { classId } : {}),
          },
        },
      },
      data: { status: TestAttemptStatus.CANCELLED },
    });
    await transaction.testStudentState.updateMany({
      where: {
        status: TestStudentStatus.IN_PROGRESS,
        release: {
          lessonId,
          ...(classId ? { classId } : {}),
        },
      },
      data: {
        status: TestStudentStatus.EXPIRED,
        lastActivityAt: cancelledAt,
      },
    });
    await transaction.testRelease.updateMany({
      where: {
        lessonId,
        ...(classId ? { classId } : {}),
        status: {
          in: [
            TestReleaseStatus.DRAFT,
            TestReleaseStatus.SCHEDULED,
            TestReleaseStatus.ACTIVE,
          ],
        },
      },
      data: {
        status: TestReleaseStatus.ARCHIVED,
        closedAt: cancelledAt,
      },
    });
  }

  private async lockLessonTestReleases(
    transaction: Prisma.TransactionClient,
    lessonId: string,
    classId?: string,
  ): Promise<void> {
    if (classId) {
      await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id"
        FROM "TestRelease"
        WHERE "lessonId" = ${lessonId} AND "classId" = ${classId}
        ORDER BY "id"
        FOR UPDATE
      `);
      return;
    }
    await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "TestRelease"
      WHERE "lessonId" = ${lessonId}
      ORDER BY "id"
      FOR UPDATE
    `);
  }

  private async assertOwnedClass(
    client: PrismaService | Prisma.TransactionClient,
    teacherId: string,
    classId: string,
  ): Promise<void> {
    const classroom = await client.class.findFirst({
      where: { id: classId, teacherId },
      select: { id: true },
    });

    if (!classroom) {
      throw new NotFoundException({
        code: 'CLASS_NOT_FOUND',
        message: 'Class not found',
      });
    }
  }

  private async lockOwnedClass(
    transaction: Prisma.TransactionClient,
    teacherId: string,
    classId: string,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "Class"
      WHERE "id" = ${classId} AND "teacherId" = ${teacherId}
      FOR UPDATE
    `);

    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'CLASS_NOT_FOUND',
        message: 'Class not found',
      });
    }
  }

  private async lockOwnedLesson(
    transaction: Prisma.TransactionClient,
    teacherId: string,
    lessonId: string,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "Lesson"
      WHERE "id" = ${lessonId} AND "teacherId" = ${teacherId}
      FOR UPDATE
    `);

    if (rows.length === 0) {
      throw this.lessonNotFound();
    }
  }

  private assertMeaningfulDraft(dto: CreateLessonDto): void {
    const hasText = [dto.title, dto.summary, dto.content].some(
      (value) => typeof value === 'string' && value.trim().length > 0,
    );
    const hasEstimatedMinutes =
      dto.estimatedMinutes !== undefined && dto.estimatedMinutes !== null;

    if (!hasText && !hasEstimatedMinutes) {
      throw new BadRequestException({
        code: 'EMPTY_LESSON_DRAFT',
        message: 'Add lesson content before creating a draft',
      });
    }
  }

  private assertLessonComplete(lesson: {
    title: string;
    summary: string;
    content: string;
  }): void {
    const missingFields = (
      [
        ['title', lesson.title],
        ['summary', lesson.summary],
        ['content', lesson.content],
      ] as const
    )
      .filter(([, value]) => value.trim().length === 0)
      .map(([field]) => field);

    if (missingFields.length > 0) {
      throw new ConflictException({
        code: 'LESSON_INCOMPLETE',
        message: 'Complete the lesson before publishing it',
        missingFields,
      });
    }
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only teacher accounts may use this endpoint',
      });
    }
  }

  private assertStudent(user: AuthUser): void {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only student accounts may use this endpoint',
      });
    }
  }

  private lessonNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'LESSON_NOT_FOUND',
      message: 'Lesson not found',
    });
  }

  private classLessonNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'CLASS_LESSON_NOT_FOUND',
      message: 'The lesson is not assigned to this class',
    });
  }

  private toLessonSummaryDto(
    lesson: LessonRecord | LessonSummaryRecord,
  ): LessonSummaryDto {
    return new LessonSummaryDto({
      id: lesson.id,
      title: lesson.title,
      summary: lesson.summary,
      contentLocale: lesson.contentLocale,
      estimatedMinutes: lesson.estimatedMinutes,
      status: lesson.status,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
      classLinks: lesson.classLinks.map(
        (link) =>
          new LessonClassLinkDto({
            classId: link.classId,
            className: link.class.name,
            position: link.position,
            publishedAt: link.publishedAt,
          }),
      ),
    });
  }

  private toLessonDetailDto(lesson: LessonRecord): LessonDetailDto {
    return new LessonDetailDto({
      ...this.toLessonSummaryDto(lesson),
      content: lesson.content,
    });
  }

  private toClassLessonItemDto(link: ClassLessonRecord): ClassLessonItemDto {
    return new ClassLessonItemDto({
      id: link.lesson.id,
      title: link.lesson.title,
      summary: link.lesson.summary,
      contentLocale: link.lesson.contentLocale,
      estimatedMinutes: link.lesson.estimatedMinutes,
      status: link.lesson.status,
      createdAt: link.lesson.createdAt,
      updatedAt: link.lesson.updatedAt,
      classId: link.classId,
      position: link.position,
      publishedAt: link.publishedAt,
    });
  }

  private toStudentLessonSummaryDto(
    link: StudentLessonSummaryRecord,
    progress: StudentLessonProgressDto,
  ): StudentLessonSummaryDto {
    return new StudentLessonSummaryDto({
      id: link.lesson.id,
      title: link.lesson.title,
      summary: link.lesson.summary,
      contentLocale: link.lesson.contentLocale,
      estimatedMinutes: link.lesson.estimatedMinutes,
      position: link.position,
      progress,
    });
  }

  private toStudentLessonDetailDto(
    link: StudentLessonDetailRecord,
    progress: StudentLessonProgressDto,
  ): StudentLessonDetailDto {
    const teacherProfile = link.lesson.teacher.profile;

    if (!teacherProfile) {
      throw new InternalServerErrorException({
        code: 'TEACHER_PROFILE_UNAVAILABLE',
        message: 'Teacher profile is unavailable',
      });
    }

    return new StudentLessonDetailDto({
      id: link.lesson.id,
      title: link.lesson.title,
      summary: link.lesson.summary,
      contentLocale: link.lesson.contentLocale,
      estimatedMinutes: link.lesson.estimatedMinutes,
      position: link.position,
      progress,
      content: link.lesson.content,
      class: new StudentLessonClassDto({
        id: link.class.id,
        name: link.class.name,
      }),
      teacher: new StudentLessonTeacherDto({
        id: link.lesson.teacher.id,
        displayName: teacherProfile.displayName,
      }),
    });
  }
}
