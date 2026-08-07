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
  LessonTaskSubmissionStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateLessonTaskDto } from './dto/create-lesson-task.dto';
import {
  LessonTaskDto,
  StudentTaskSubmissionDto,
  TeacherSubmissionClassDto,
  TeacherSubmissionStudentDto,
  TeacherTaskSubmissionDto,
} from './dto/lesson-task.dto';
import { ReviewLessonTaskSubmissionDto } from './dto/review-lesson-task-submission.dto';
import { SubmitLessonTaskDto } from './dto/submit-lesson-task.dto';
import { UpdateLessonTaskDto } from './dto/update-lesson-task.dto';

const lessonTaskSelect = {
  id: true,
  lessonId: true,
  title: true,
  prompt: true,
  position: true,
  isRequired: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LessonTaskSelect;

const studentSubmissionSelect = {
  id: true,
  taskId: true,
  answerText: true,
  status: true,
  teacherComment: true,
  submittedAt: true,
  reviewedAt: true,
  updatedAt: true,
} satisfies Prisma.LessonTaskSubmissionSelect;

const teacherSubmissionSelect = {
  ...studentSubmissionSelect,
  task: {
    select: {
      title: true,
      position: true,
      isRequired: true,
    },
  },
  student: {
    select: {
      id: true,
      profile: { select: { displayName: true } },
    },
  },
  class: {
    select: { id: true, name: true },
  },
} satisfies Prisma.LessonTaskSubmissionSelect;

type LessonTaskRecord = Prisma.LessonTaskGetPayload<{
  select: typeof lessonTaskSelect;
}>;
type StudentSubmissionRecord = Prisma.LessonTaskSubmissionGetPayload<{
  select: typeof studentSubmissionSelect;
}>;
type TeacherSubmissionRecord = Prisma.LessonTaskSubmissionGetPayload<{
  select: typeof teacherSubmissionSelect;
}>;

@Injectable()
export class LessonTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listLessonTasks(
    user: AuthUser,
    lessonId: string,
  ): Promise<LessonTaskDto[]> {
    this.assertTeacher(user);
    await this.assertOwnedLesson(user.id, lessonId);

    const tasks = await this.prisma.lessonTask.findMany({
      where: { lessonId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: lessonTaskSelect,
    });

    return tasks.map((task) => this.toLessonTaskDto(task));
  }

  async createLessonTask(
    user: AuthUser,
    lessonId: string,
    dto: CreateLessonTaskDto,
  ): Promise<LessonTaskDto> {
    this.assertTeacher(user);

    const task = await this.prisma.$transaction(async (transaction) => {
      await this.lockEditableOwnedLesson(transaction, user.id, lessonId);
      const positions = await transaction.lessonTask.aggregate({
        where: { lessonId },
        _max: { position: true },
      });

      return transaction.lessonTask.create({
        data: {
          lessonId,
          title: dto.title.trim(),
          prompt: dto.prompt,
          position: (positions._max.position ?? 0) + 1,
          isRequired: dto.isRequired ?? true,
        },
        select: lessonTaskSelect,
      });
    });

    return this.toLessonTaskDto(task);
  }

  async updateLessonTask(
    user: AuthUser,
    lessonId: string,
    taskId: string,
    dto: UpdateLessonTaskDto,
  ): Promise<LessonTaskDto> {
    this.assertTeacher(user);

    const task = await this.prisma.$transaction(async (transaction) => {
      await this.lockEditableOwnedLesson(transaction, user.id, lessonId);
      await this.assertTaskInLesson(transaction, lessonId, taskId);

      return transaction.lessonTask.update({
        where: { id: taskId },
        data: {
          title: dto.title?.trim(),
          prompt: dto.prompt,
          isRequired: dto.isRequired,
        },
        select: lessonTaskSelect,
      });
    });

    return this.toLessonTaskDto(task);
  }

  async deleteLessonTask(
    user: AuthUser,
    lessonId: string,
    taskId: string,
  ): Promise<void> {
    this.assertTeacher(user);

    await this.prisma.$transaction(async (transaction) => {
      await this.lockEditableOwnedLesson(transaction, user.id, lessonId);
      const task = await transaction.lessonTask.findFirst({
        where: { id: taskId, lessonId },
        select: {
          id: true,
          _count: { select: { submissions: true } },
        },
      });

      if (!task) {
        throw this.taskNotFound();
      }

      if (task._count.submissions > 0) {
        throw new ConflictException({
          code: 'LESSON_TASK_HAS_SUBMISSIONS',
          message: 'A task with student submissions cannot be deleted',
        });
      }

      await transaction.lessonTask.delete({ where: { id: task.id } });
    });
  }

  async listLessonTaskSubmissions(
    user: AuthUser,
    lessonId: string,
  ): Promise<TeacherTaskSubmissionDto[]> {
    this.assertTeacher(user);
    await this.assertOwnedLesson(user.id, lessonId);

    const submissions = await this.prisma.lessonTaskSubmission.findMany({
      where: {
        task: { lessonId, lesson: { teacherId: user.id } },
        class: { teacherId: user.id },
      },
      orderBy: [
        { task: { position: 'asc' } },
        { submittedAt: 'desc' },
        { id: 'asc' },
      ],
      select: teacherSubmissionSelect,
    });

    return submissions.map((submission) =>
      this.toTeacherSubmissionDto(submission),
    );
  }

  async reviewLessonTaskSubmission(
    user: AuthUser,
    lessonId: string,
    taskId: string,
    submissionId: string,
    dto: ReviewLessonTaskSubmissionDto,
  ): Promise<TeacherTaskSubmissionDto> {
    this.assertTeacher(user);
    this.assertReviewStatus(dto.status);

    const submission = await this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedLesson(transaction, user.id, lessonId);
      await this.assertTaskInLesson(transaction, lessonId, taskId);

      const existing = await transaction.lessonTaskSubmission.findFirst({
        where: {
          id: submissionId,
          taskId,
          class: { teacherId: user.id },
        },
        select: { id: true },
      });

      if (!existing) {
        throw this.submissionNotFound();
      }

      return transaction.lessonTaskSubmission.update({
        where: { id: existing.id },
        data: {
          status: dto.status,
          teacherComment: this.normalizeOptionalText(dto.teacherComment),
          reviewedAt: new Date(),
        },
        select: teacherSubmissionSelect,
      });
    });

    return this.toTeacherSubmissionDto(submission);
  }

  async submitLessonTask(
    user: AuthUser,
    lessonId: string,
    taskId: string,
    dto: SubmitLessonTaskDto,
  ): Promise<StudentTaskSubmissionDto> {
    this.assertStudent(user);

    const submission = await this.prisma.$transaction(async (transaction) => {
      const student = await transaction.user.findUnique({
        where: { id: user.id },
        select: { studentClassId: true },
      });
      const classId = student?.studentClassId;

      if (!classId) {
        throw this.lessonNotFound();
      }

      await this.lockLesson(transaction, lessonId);
      const classLesson = await transaction.classLesson.findFirst({
        where: {
          classId,
          lessonId,
          publishedAt: { not: null },
          lesson: { status: LessonStatus.PUBLISHED },
        },
        select: { classId: true },
      });

      if (!classLesson) {
        throw this.lessonNotFound();
      }

      await this.assertTaskInLesson(transaction, lessonId, taskId);
      const uniqueKey = {
        taskId_studentId_classId: {
          taskId,
          studentId: user.id,
          classId,
        },
      };
      const existing = await transaction.lessonTaskSubmission.findUnique({
        where: uniqueKey,
        select: { id: true, status: true },
      });

      if (existing?.status === LessonTaskSubmissionStatus.APPROVED) {
        throw new ConflictException({
          code: 'TASK_SUBMISSION_APPROVED',
          message: 'An approved task submission cannot be changed',
        });
      }

      const submittedAt = new Date();
      if (existing) {
        return transaction.lessonTaskSubmission.update({
          where: { id: existing.id },
          data: {
            answerText: dto.answerText,
            status: LessonTaskSubmissionStatus.SUBMITTED,
            teacherComment: null,
            submittedAt,
            reviewedAt: null,
          },
          select: studentSubmissionSelect,
        });
      }

      return transaction.lessonTaskSubmission.create({
        data: {
          taskId,
          studentId: user.id,
          classId,
          answerText: dto.answerText,
          submittedAt,
        },
        select: studentSubmissionSelect,
      });
    });

    return this.toStudentSubmissionDto(submission);
  }

  private async assertOwnedLesson(
    teacherId: string,
    lessonId: string,
  ): Promise<void> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, teacherId },
      select: { id: true },
    });

    if (!lesson) {
      throw this.lessonNotFound();
    }
  }

  private async assertTaskInLesson(
    transaction: Prisma.TransactionClient,
    lessonId: string,
    taskId: string,
  ): Promise<void> {
    const task = await transaction.lessonTask.findFirst({
      where: { id: taskId, lessonId },
      select: { id: true },
    });

    if (!task) {
      throw this.taskNotFound();
    }
  }

  private async lockOwnedLesson(
    transaction: Prisma.TransactionClient,
    teacherId: string,
    lessonId: string,
  ): Promise<{ id: string; status: LessonStatus }> {
    const rows = await transaction.$queryRaw<
      { id: string; status: LessonStatus }[]
    >(Prisma.sql`
      SELECT "id", "status"
      FROM "Lesson"
      WHERE "id" = ${lessonId} AND "teacherId" = ${teacherId}
      FOR UPDATE
    `);

    if (rows.length === 0) {
      throw this.lessonNotFound();
    }

    return rows[0];
  }

  private async lockEditableOwnedLesson(
    transaction: Prisma.TransactionClient,
    teacherId: string,
    lessonId: string,
  ): Promise<void> {
    const lesson = await this.lockOwnedLesson(transaction, teacherId, lessonId);

    if (lesson.status === LessonStatus.ARCHIVED) {
      throw new ConflictException({
        code: 'LESSON_ARCHIVED',
        message: 'Restore the lesson before editing its tasks',
      });
    }
  }

  private async lockLesson(
    transaction: Prisma.TransactionClient,
    lessonId: string,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "Lesson"
      WHERE "id" = ${lessonId}
      FOR UPDATE
    `);

    if (rows.length === 0) {
      throw this.lessonNotFound();
    }
  }

  private assertReviewStatus(status: LessonTaskSubmissionStatus): void {
    if (
      status !== LessonTaskSubmissionStatus.APPROVED &&
      status !== LessonTaskSubmissionStatus.RETURNED
    ) {
      throw new BadRequestException({
        code: 'INVALID_TASK_REVIEW_STATUS',
        message: 'Review status must be APPROVED or RETURNED',
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

  private taskNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'LESSON_TASK_NOT_FOUND',
      message: 'Lesson task not found',
    });
  }

  private submissionNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'LESSON_TASK_SUBMISSION_NOT_FOUND',
      message: 'Lesson task submission not found',
    });
  }

  private normalizeOptionalText(
    value: string | null | undefined,
  ): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private toLessonTaskDto(task: LessonTaskRecord): LessonTaskDto {
    return new LessonTaskDto({ ...task });
  }

  private toStudentSubmissionDto(
    submission: StudentSubmissionRecord,
  ): StudentTaskSubmissionDto {
    return new StudentTaskSubmissionDto({ ...submission });
  }

  private toTeacherSubmissionDto(
    submission: TeacherSubmissionRecord,
  ): TeacherTaskSubmissionDto {
    if (!submission.student.profile) {
      throw new InternalServerErrorException({
        code: 'STUDENT_PROFILE_UNAVAILABLE',
        message: 'Student profile is unavailable',
      });
    }

    return new TeacherTaskSubmissionDto({
      id: submission.id,
      taskId: submission.taskId,
      taskTitle: submission.task.title,
      taskPosition: submission.task.position,
      taskIsRequired: submission.task.isRequired,
      student: new TeacherSubmissionStudentDto({
        id: submission.student.id,
        displayName: submission.student.profile.displayName,
      }),
      class: new TeacherSubmissionClassDto({
        id: submission.class.id,
        name: submission.class.name,
      }),
      answerText: submission.answerText,
      status: submission.status,
      teacherComment: submission.teacherComment,
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt,
      updatedAt: submission.updatedAt,
    });
  }
}
