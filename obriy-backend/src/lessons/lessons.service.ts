import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { LessonStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateLessonDto } from './dto/create-lesson.dto';
import {
  ClassLessonItemDto,
  LessonClassLinkDto,
  LessonDetailDto,
  LessonSummaryDto,
} from './dto/lesson.dto';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto';
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

type LessonRecord = Prisma.LessonGetPayload<{ include: typeof lessonInclude }>;
type LessonSummaryRecord = Prisma.LessonGetPayload<{
  select: typeof lessonSummarySelect;
}>;
type ClassLessonRecord = Prisma.ClassLessonGetPayload<{
  select: typeof classLessonSelect;
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
}
