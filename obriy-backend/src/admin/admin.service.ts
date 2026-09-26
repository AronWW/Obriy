import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AdminAuditAction,
  AdminAuditTargetType,
  LessonModerationCaseStatus,
  LessonModerationStatus,
  LessonStatus,
  Locale,
  NotificationType,
  Prisma,
  TestReleaseStatus,
  UserRole,
  UserStatus,
  SuspensionAppealStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { authEvents } from '../auth/auth.events';
import type { AuthUser } from '../common/types/auth-user.type';
import { MailService } from '../mail/mail.service';
import {
  type CreateNotificationInput,
  NotificationsService,
} from '../notifications/notifications.service';
import type {
  AdminAuditQueryDto,
  AdminModerationActionDto,
  AdminModerationQueryDto,
  AdminPageQueryDto,
  AdminReasonDto,
  AdminUsersQueryDto,
  AdminAppealsQueryDto,
  AdminAppealDecisionDto,
  ReportLessonDto,
  ResubmitLessonModerationDto,
} from './dto/admin-input.dto';
import {
  AdminAuditLogDto,
  AdminAuditLogPageDto,
  AdminClassDetailDto,
  AdminClassDto,
  AdminClassPageDto,
  AdminDashboardDto,
  AdminUserDto,
  AdminUserPageDto,
  AdminUserStatsDto,
  LessonModerationCaseDto,
  LessonModerationCasePageDto,
  LessonReportDto,
  LessonReportReceiptDto,
  TeacherLessonModerationDto,
  AdminSuspensionAppealDto,
  AdminSuspensionAppealPageDto,
} from './dto/admin-output.dto';

const ACTIVE_CASE_STATUSES = [
  LessonModerationCaseStatus.REPORTED,
  LessonModerationCaseStatus.UNDER_REVIEW,
  LessonModerationCaseStatus.CHANGES_REQUESTED,
] as const;

const userSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: {
      displayName: true,
      avatarUrl: true,
      subjectArea: true,
      preferredLocale: true,
    },
  },
  studentClass: { select: { id: true, name: true } },
  _count: {
    select: {
      taughtClasses: true,
      authoredLessons: true,
      authoredAssignments: true,
      authoredTests: true,
      parentLinks: true,
      childLinks: true,
    },
  },
} satisfies Prisma.UserSelect;

const moderationCaseSelect = {
  id: true,
  lessonId: true,
  status: true,
  initialSnapshot: true,
  resolutionNote: true,
  editVersion: true,
  createdAt: true,
  updatedAt: true,
  lesson: {
    select: {
      id: true,
      teacherId: true,
      title: true,
      summary: true,
      content: true,
      contentLocale: true,
      estimatedMinutes: true,
      status: true,
      moderationStatus: true,
      updatedAt: true,
      teacher: { select: { profile: { select: { displayName: true } } } },
    },
  },
  reports: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      category: true,
      details: true,
      reporterId: true,
      subjectStudentId: true,
      classId: true,
      createdAt: true,
      reporter: {
        select: {
          role: true,
          profile: { select: { displayName: true } },
        },
      },
      subjectStudent: {
        select: { profile: { select: { displayName: true } } },
      },
      class: { select: { name: true } },
    },
  },
} satisfies Prisma.LessonModerationCaseSelect;

type UserRecord = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type ModerationCaseRecord = Prisma.LessonModerationCaseGetPayload<{
  select: typeof moderationCaseSelect;
}>;
type PageCursor = { createdAt: string; id: string };
type ModerationAction =
  'hide' | 'dismiss' | 'request-changes' | 'approve' | 'remove';

const suspensionAppealSelect = {
  id: true,
  userId: true,
  status: true,
  message: true,
  resolutionNote: true,
  reviewedAt: true,
  createdAt: true,
  suspensionAuditLog: { select: { reason: true, createdAt: true } },
  user: {
    select: {
      email: true,
      role: true,
      status: true,
      profile: { select: { displayName: true, preferredLocale: true } },
    },
  },
} satisfies Prisma.SuspensionAppealSelect;

type SuspensionAppealRecord = Prisma.SuspensionAppealGetPayload<{
  select: typeof suspensionAppealSelect;
}>;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  async dashboard(user: AuthUser): Promise<AdminDashboardDto> {
    this.assertAdmin(user);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      users,
      students,
      teachers,
      parents,
      pendingUsers,
      suspendedUsers,
      newUsersLast30Days,
      classes,
      publishedLessons,
      publishedReleases,
      messagesLast30Days,
      openModerationCases,
      pendingSuspensionAppeals,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.STUDENT } }),
      this.prisma.user.count({ where: { role: UserRole.TEACHER } }),
      this.prisma.user.count({ where: { role: UserRole.PARENT } }),
      this.prisma.user.count({ where: { status: UserStatus.PENDING } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.class.count(),
      this.prisma.lesson.count({
        where: {
          status: LessonStatus.PUBLISHED,
          moderationStatus: LessonModerationStatus.CLEAR,
        },
      }),
      this.prisma.testRelease.count({
        where: {
          publishedAt: { not: null },
          status: {
            in: [
              TestReleaseStatus.SCHEDULED,
              TestReleaseStatus.ACTIVE,
              TestReleaseStatus.CLOSED,
            ],
          },
          OR: [
            { lessonId: null },
            { lesson: { moderationStatus: LessonModerationStatus.CLEAR } },
          ],
        },
      }),
      this.prisma.message.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.lessonModerationCase.count({
        where: { status: { in: [...ACTIVE_CASE_STATUSES] } },
      }),
      this.prisma.suspensionAppeal.count({
        where: { status: SuspensionAppealStatus.PENDING },
      }),
    ]);
    return new AdminDashboardDto({
      users,
      students,
      teachers,
      parents,
      pendingUsers,
      suspendedUsers,
      newUsersLast30Days,
      classes,
      publishedLessons,
      publishedReleases,
      messagesLast30Days,
      openModerationCases,
      pendingSuspensionAppeals,
    });
  }

  async listUsers(
    user: AuthUser,
    query: AdminUsersQueryDto,
  ): Promise<AdminUserPageDto> {
    this.assertAdmin(user);
    const cursor = this.decodeCursor(query.cursor);
    const search = query.search?.trim();
    const records = await this.prisma.user.findMany({
      where: {
        role: query.role,
        status: query.status,
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                {
                  profile: {
                    displayName: { contains: search, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
        ...(cursor ? this.beforeCursor(cursor) : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: userSelect,
    });
    const items = records.slice(0, query.limit);
    return new AdminUserPageDto({
      items: items.map((record) => this.toUserDto(record)),
      nextCursor:
        records.length > query.limit ? this.cursorFor(items.at(-1)) : null,
    });
  }

  async getUser(user: AuthUser, userId: string): Promise<AdminUserDto> {
    this.assertAdmin(user);
    const record = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!record) throw this.notFound('USER_NOT_FOUND', 'User not found');
    return this.toUserDto(record);
  }

  async suspendUser(
    user: AuthUser,
    userId: string,
    dto: AdminReasonDto,
  ): Promise<AdminUserDto> {
    this.assertAdmin(user);
    const reason = dto.reason.trim();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true },
      });
      this.assertMutableUser(user, target);
      if (target?.status === UserStatus.SUSPENDED)
        throw this.conflict(
          'USER_ALREADY_SUSPENDED',
          'User is already suspended',
        );
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.SUSPENDED,
          sessionVersion: { increment: 1 },
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: user.id,
          action: AdminAuditAction.USER_SUSPENDED,
          targetType: AdminAuditTargetType.USER,
          targetId: userId,
          reason,
          metadata: { previousStatus: target?.status ?? null },
        },
      });
      return tx.user.findUnique({ where: { id: userId }, select: userSelect });
    });
    this.events.emit(authEvents.sessionsRevoked, { userId });
    if (!updated) throw this.notFound('USER_NOT_FOUND', 'User not found');
    return this.toUserDto(updated);
  }

  async restoreUser(
    user: AuthUser,
    userId: string,
    dto: AdminReasonDto,
  ): Promise<AdminUserDto> {
    this.assertAdmin(user);
    const reason = dto.reason.trim();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true, emailVerifiedAt: true },
      });
      this.assertMutableUser(user, target);
      if (target?.status !== UserStatus.SUSPENDED)
        throw this.conflict('USER_NOT_SUSPENDED', 'User is not suspended');
      const nextStatus = target.emailVerifiedAt
        ? UserStatus.ACTIVE
        : UserStatus.PENDING;
      await tx.user.update({
        where: { id: userId },
        data: { status: nextStatus },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: user.id,
          action: AdminAuditAction.USER_RESTORED,
          targetType: AdminAuditTargetType.USER,
          targetId: userId,
          reason,
          metadata: { restoredStatus: nextStatus },
        },
      });
      const pendingAppeal = await tx.suspensionAppeal.findFirst({
        where: { userId, status: SuspensionAppealStatus.PENDING },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      });
      if (pendingAppeal) {
        await tx.suspensionAppeal.update({
          where: { id: pendingAppeal.id },
          data: {
            status: SuspensionAppealStatus.APPROVED,
            resolutionNote: reason,
            reviewedById: user.id,
            reviewedAt: new Date(),
          },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId: user.id,
            action: AdminAuditAction.SUSPENSION_APPEAL_APPROVED,
            targetType: AdminAuditTargetType.SUSPENSION_APPEAL,
            targetId: pendingAppeal.id,
            reason,
            metadata: { userId, resolvedByManualRestore: true },
          },
        });
      }
      return {
        record: await tx.user.findUnique({
          where: { id: userId },
          select: userSelect,
        }),
        resolvedAppeal: Boolean(pendingAppeal),
      };
    });
    if (!result.record) throw this.notFound('USER_NOT_FOUND', 'User not found');
    if (result.resolvedAppeal) {
      await this.sendAppealDecision(result.record, true, reason);
    }
    return this.toUserDto(result.record);
  }

  async listSuspensionAppeals(
    user: AuthUser,
    query: AdminAppealsQueryDto,
  ): Promise<AdminSuspensionAppealPageDto> {
    this.assertAdmin(user);
    const cursor = this.decodeCursor(query.cursor);
    const search = query.search?.trim();
    const records = await this.prisma.suspensionAppeal.findMany({
      where: {
        status: query.status,
        ...(search
          ? {
              OR: [
                {
                  user: {
                    email: { contains: search, mode: 'insensitive' as const },
                  },
                },
                {
                  user: {
                    profile: {
                      displayName: {
                        contains: search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
        ...(cursor ? this.beforeCursor(cursor) : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: suspensionAppealSelect,
    });
    const items = records.slice(0, query.limit);
    return new AdminSuspensionAppealPageDto({
      items: items.map((record) => this.toSuspensionAppealDto(record)),
      nextCursor:
        records.length > query.limit ? this.cursorFor(items.at(-1)) : null,
    });
  }

  async getSuspensionAppeal(
    user: AuthUser,
    appealId: string,
  ): Promise<AdminSuspensionAppealDto> {
    this.assertAdmin(user);
    const record = await this.prisma.suspensionAppeal.findUnique({
      where: { id: appealId },
      select: suspensionAppealSelect,
    });
    if (!record)
      throw this.notFound('SUSPENSION_APPEAL_NOT_FOUND', 'Appeal not found');
    return this.toSuspensionAppealDto(record);
  }

  async resolveSuspensionAppeal(
    actor: AuthUser,
    appealId: string,
    dto: AdminAppealDecisionDto,
    approved: boolean,
  ): Promise<AdminSuspensionAppealDto> {
    this.assertAdmin(actor);
    const resolutionNote = dto.resolutionNote.trim();
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "SuspensionAppeal" WHERE "id" = ${appealId} FOR UPDATE`;
      const appeal = await tx.suspensionAppeal.findUnique({
        where: { id: appealId },
        select: { id: true, userId: true, status: true },
      });
      if (!appeal)
        throw this.notFound('SUSPENSION_APPEAL_NOT_FOUND', 'Appeal not found');
      if (appeal.status !== SuspensionAppealStatus.PENDING) {
        throw this.conflict(
          'SUSPENSION_APPEAL_ALREADY_RESOLVED',
          'Appeal is already resolved',
        );
      }
      const target = await tx.user.findUnique({
        where: { id: appeal.userId },
        select: { status: true, emailVerifiedAt: true },
      });
      if (!target) throw this.notFound('USER_NOT_FOUND', 'User not found');
      if (approved && target.status !== UserStatus.SUSPENDED) {
        throw this.conflict('USER_NOT_SUSPENDED', 'User is not suspended');
      }
      const now = new Date();
      await tx.suspensionAppeal.update({
        where: { id: appealId },
        data: {
          status: approved
            ? SuspensionAppealStatus.APPROVED
            : SuspensionAppealStatus.REJECTED,
          resolutionNote,
          reviewedById: actor.id,
          reviewedAt: now,
        },
      });
      if (approved) {
        await tx.user.update({
          where: { id: appeal.userId },
          data: {
            status: target.emailVerifiedAt
              ? UserStatus.ACTIVE
              : UserStatus.PENDING,
          },
        });
      }
      await tx.adminAuditLog.create({
        data: {
          actorId: actor.id,
          action: approved
            ? AdminAuditAction.SUSPENSION_APPEAL_APPROVED
            : AdminAuditAction.SUSPENSION_APPEAL_REJECTED,
          targetType: AdminAuditTargetType.SUSPENSION_APPEAL,
          targetId: appealId,
          reason: resolutionNote.slice(0, 500),
          metadata: { userId: appeal.userId },
        },
      });
      const saved = await tx.suspensionAppeal.findUnique({
        where: { id: appealId },
        select: suspensionAppealSelect,
      });
      if (!saved)
        throw this.notFound('SUSPENSION_APPEAL_NOT_FOUND', 'Appeal not found');
      return saved;
    });
    await this.sendAppealDecision(record.user, approved, resolutionNote);
    return this.toSuspensionAppealDto(record);
  }

  async listClasses(
    user: AuthUser,
    query: AdminPageQueryDto,
  ): Promise<AdminClassPageDto> {
    this.assertAdmin(user);
    const cursor = this.decodeCursor(query.cursor);
    const search = query.search?.trim();
    const records = await this.prisma.class.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                {
                  teacher: { email: { contains: search, mode: 'insensitive' } },
                },
                {
                  teacher: {
                    profile: {
                      displayName: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              ],
            }
          : {}),
        ...(cursor ? this.beforeCursor(cursor) : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: {
        teacher: {
          select: { email: true, profile: { select: { displayName: true } } },
        },
        _count: {
          select: { students: true, lessonLinks: true, testReleases: true },
        },
      },
    });
    const items = records.slice(0, query.limit);
    return new AdminClassPageDto({
      items: items.map((record) => this.toClassDto(record)),
      nextCursor:
        records.length > query.limit ? this.cursorFor(items.at(-1)) : null,
    });
  }

  async getClass(
    user: AuthUser,
    classId: string,
  ): Promise<AdminClassDetailDto> {
    this.assertAdmin(user);
    const record = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        teacher: {
          select: { email: true, profile: { select: { displayName: true } } },
        },
        students: {
          orderBy: [{ profile: { displayName: 'asc' } }, { id: 'asc' }],
          select: userSelect,
        },
        _count: {
          select: { students: true, lessonLinks: true, testReleases: true },
        },
      },
    });
    if (!record) throw this.notFound('CLASS_NOT_FOUND', 'Class not found');
    return new AdminClassDetailDto({
      ...this.toClassDto(record),
      students: record.students.map((student) => this.toUserDto(student)),
    });
  }

  async listModeration(
    user: AuthUser,
    query: AdminModerationQueryDto,
  ): Promise<LessonModerationCasePageDto> {
    this.assertAdmin(user);
    const cursor = this.decodeCursor(query.cursor);
    const search = query.search?.trim();
    const records = await this.prisma.lessonModerationCase.findMany({
      where: {
        status: query.status,
        ...(search
          ? {
              OR: [
                {
                  lesson: { title: { contains: search, mode: 'insensitive' } },
                },
                {
                  lesson: {
                    teacher: {
                      profile: {
                        displayName: { contains: search, mode: 'insensitive' },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
        ...(cursor ? this.beforeCursor(cursor) : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: moderationCaseSelect,
    });
    const items = records.slice(0, query.limit);
    return new LessonModerationCasePageDto({
      items: items.map((record) => this.toCaseDto(record)),
      nextCursor:
        records.length > query.limit ? this.cursorFor(items.at(-1)) : null,
    });
  }

  async getModerationCase(
    user: AuthUser,
    caseId: string,
  ): Promise<LessonModerationCaseDto> {
    this.assertAdmin(user);
    const record = await this.prisma.lessonModerationCase.findUnique({
      where: { id: caseId },
      select: moderationCaseSelect,
    });
    if (!record)
      throw this.notFound(
        'MODERATION_CASE_NOT_FOUND',
        'Moderation case not found',
      );
    return this.toCaseDto(record);
  }

  hideLesson(user: AuthUser, caseId: string, dto: AdminModerationActionDto) {
    return this.moderate(user, caseId, dto, 'hide');
  }
  dismissReport(user: AuthUser, caseId: string, dto: AdminModerationActionDto) {
    return this.moderate(user, caseId, dto, 'dismiss');
  }
  requestLessonChanges(
    user: AuthUser,
    caseId: string,
    dto: AdminModerationActionDto,
  ) {
    return this.moderate(user, caseId, dto, 'request-changes');
  }
  approveLesson(user: AuthUser, caseId: string, dto: AdminModerationActionDto) {
    return this.moderate(user, caseId, dto, 'approve');
  }
  removeLesson(user: AuthUser, caseId: string, dto: AdminModerationActionDto) {
    return this.moderate(user, caseId, dto, 'remove');
  }

  reportStudentLesson(
    user: AuthUser,
    lessonId: string,
    dto: ReportLessonDto,
  ): Promise<LessonReportReceiptDto> {
    if (user.role !== UserRole.STUDENT)
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only students may use this endpoint',
      });
    return this.createReport(user.id, user.id, lessonId, dto);
  }

  async reportParentLesson(
    user: AuthUser,
    childId: string,
    lessonId: string,
    dto: ReportLessonDto,
  ): Promise<LessonReportReceiptDto> {
    if (user.role !== UserRole.PARENT)
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only parents may use this endpoint',
      });
    const link = await this.prisma.parentChild.findUnique({
      where: { parentId_childId: { parentId: user.id, childId } },
      select: { childId: true },
    });
    if (!link) throw this.notFound('LESSON_NOT_FOUND', 'Lesson not found');
    return this.createReport(user.id, childId, lessonId, dto);
  }

  async resubmitLesson(
    user: AuthUser,
    lessonId: string,
    dto: ResubmitLessonModerationDto,
  ): Promise<TeacherLessonModerationDto> {
    if (user.role !== UserRole.TEACHER)
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only teachers may use this endpoint',
      });
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Lesson" WHERE "id" = ${lessonId} FOR UPDATE`;
      const lesson = await tx.lesson.findFirst({
        where: { id: lessonId, teacherId: user.id },
        select: {
          id: true,
          title: true,
          summary: true,
          content: true,
          status: true,
          moderationStatus: true,
        },
      });
      if (!lesson) throw this.notFound('LESSON_NOT_FOUND', 'Lesson not found');
      if (lesson.moderationStatus !== LessonModerationStatus.CHANGES_REQUESTED)
        throw this.conflict(
          'LESSON_NOT_AWAITING_CHANGES',
          'Lesson is not awaiting changes',
        );
      if (lesson.status === LessonStatus.ARCHIVED)
        throw this.conflict(
          'LESSON_ARCHIVED',
          'An archived lesson cannot be resubmitted',
        );
      if (
        ![lesson.title, lesson.summary, lesson.content].every(
          (value) => value.trim().length > 0,
        )
      )
        throw this.conflict(
          'LESSON_INCOMPLETE',
          'Complete the lesson before resubmitting it',
        );
      const moderationCase = await tx.lessonModerationCase.findFirst({
        where: {
          lessonId,
          status: LessonModerationCaseStatus.CHANGES_REQUESTED,
        },
      });
      if (!moderationCase)
        throw this.notFound(
          'MODERATION_CASE_NOT_FOUND',
          'Moderation case not found',
        );
      if (moderationCase.editVersion !== dto.expectedEditVersion)
        throw this.conflict(
          'MODERATION_EDIT_CONFLICT',
          'Moderation case has changed',
        );
      const updated = await tx.lessonModerationCase.update({
        where: { id: moderationCase.id },
        data: {
          status: LessonModerationCaseStatus.UNDER_REVIEW,
          editVersion: { increment: 1 },
        },
      });
      await tx.lesson.update({
        where: { id: lessonId },
        data: { moderationStatus: LessonModerationStatus.UNDER_REVIEW },
      });
      return updated;
    });
    return new TeacherLessonModerationDto({
      caseId: record.id,
      status: LessonModerationStatus.UNDER_REVIEW,
      editVersion: record.editVersion,
      resolutionNote: record.resolutionNote,
    });
  }

  async listAuditLogs(
    user: AuthUser,
    query: AdminAuditQueryDto,
  ): Promise<AdminAuditLogPageDto> {
    this.assertAdmin(user);
    const cursor = this.decodeCursor(query.cursor);
    const search = query.search?.trim();
    const records = await this.prisma.adminAuditLog.findMany({
      where: {
        action: query.action,
        ...(search
          ? {
              OR: [
                { reason: { contains: search, mode: 'insensitive' } },
                { targetId: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(cursor ? this.beforeCursor(cursor) : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: {
        actor: {
          select: { email: true, profile: { select: { displayName: true } } },
        },
      },
    });
    const items = records.slice(0, query.limit);
    return new AdminAuditLogPageDto({
      items: items.map(
        (record) =>
          new AdminAuditLogDto({
            id: record.id,
            actorId: record.actorId,
            actorName: record.actor.profile?.displayName ?? 'Admin',
            actorEmail: record.actor.email,
            action: record.action,
            targetType: record.targetType,
            targetId: record.targetId,
            reason: record.reason,
            metadata: this.jsonObject(record.metadata),
            createdAt: record.createdAt,
          }),
      ),
      nextCursor:
        records.length > query.limit ? this.cursorFor(items.at(-1)) : null,
    });
  }

  private async createReport(
    reporterId: string,
    subjectStudentId: string,
    lessonId: string,
    dto: ReportLessonDto,
  ): Promise<LessonReportReceiptDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Lesson" WHERE "id" = ${lessonId} FOR UPDATE`;
        const student = await tx.user.findFirst({
          where: { id: subjectStudentId, role: UserRole.STUDENT },
          select: { studentClassId: true },
        });
        if (!student?.studentClassId)
          throw this.notFound('LESSON_NOT_FOUND', 'Lesson not found');
        const link = await tx.classLesson.findFirst({
          where: {
            classId: student.studentClassId,
            lessonId,
            publishedAt: { not: null },
            lesson: {
              status: LessonStatus.PUBLISHED,
              moderationStatus: LessonModerationStatus.CLEAR,
            },
          },
          select: {
            classId: true,
            lesson: {
              select: {
                id: true,
                title: true,
                summary: true,
                content: true,
                contentLocale: true,
                estimatedMinutes: true,
                updatedAt: true,
              },
            },
          },
        });
        if (!link) throw this.notFound('LESSON_NOT_FOUND', 'Lesson not found');
        let moderationCase = await tx.lessonModerationCase.findFirst({
          where: { lessonId, status: { in: [...ACTIVE_CASE_STATUSES] } },
          orderBy: { createdAt: 'desc' },
        });
        if (!moderationCase)
          moderationCase = await tx.lessonModerationCase.create({
            data: {
              lessonId,
              initialSnapshot: this.lessonSnapshot(link.lesson),
            },
          });
        const report = await tx.lessonReport.create({
          data: {
            caseId: moderationCase.id,
            reporterId,
            subjectStudentId,
            classId: link.classId,
            category: dto.category,
            details: dto.details.trim(),
          },
        });
        return new LessonReportReceiptDto({
          caseId: moderationCase.id,
          status: moderationCase.status,
          reportedAt: report.createdAt,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw this.conflict(
          'LESSON_REPORT_DUPLICATE',
          'You already reported this lesson',
        );
      throw error;
    }
  }

  private async moderate(
    user: AuthUser,
    caseId: string,
    dto: AdminModerationActionDto,
    action: ModerationAction,
  ): Promise<LessonModerationCaseDto> {
    this.assertAdmin(user);
    const reason = dto.reason.trim();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "LessonModerationCase" WHERE "id" = ${caseId} FOR UPDATE`;
      const existing = await tx.lessonModerationCase.findUnique({
        where: { id: caseId },
        select: moderationCaseSelect,
      });
      if (!existing)
        throw this.notFound(
          'MODERATION_CASE_NOT_FOUND',
          'Moderation case not found',
        );
      if (existing.editVersion !== dto.expectedEditVersion)
        throw this.conflict(
          'MODERATION_EDIT_CONFLICT',
          'Moderation case has changed',
        );
      const transition = this.moderationTransition(existing.status, action);
      const now = new Date();
      if (action === 'remove') {
        await tx.testRelease.updateMany({
          where: {
            lessonId: existing.lessonId,
            status: {
              in: [
                TestReleaseStatus.DRAFT,
                TestReleaseStatus.SCHEDULED,
                TestReleaseStatus.ACTIVE,
              ],
            },
          },
          data: { status: TestReleaseStatus.ARCHIVED, closedAt: now },
        });
        await tx.classLesson.updateMany({
          where: { lessonId: existing.lessonId },
          data: { publishedAt: null },
        });
      }
      await tx.lesson.update({
        where: { id: existing.lessonId },
        data: {
          moderationStatus: transition.lessonStatus,
          ...(action === 'remove' ? { status: LessonStatus.ARCHIVED } : {}),
        },
      });
      await tx.lessonModerationCase.update({
        where: { id: caseId },
        data: {
          status: transition.caseStatus,
          resolutionNote: reason,
          reviewedById: user.id,
          editVersion: { increment: 1 },
          resolvedAt: transition.resolved ? now : null,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: user.id,
          action: transition.auditAction,
          targetType: AdminAuditTargetType.MODERATION_CASE,
          targetId: caseId,
          reason,
          metadata: {
            lessonId: existing.lessonId,
            previousStatus: existing.status,
          },
        },
      });
      const updated = await tx.lessonModerationCase.findUnique({
        where: { id: caseId },
        select: moderationCaseSelect,
      });
      if (!updated)
        throw this.notFound(
          'MODERATION_CASE_NOT_FOUND',
          'Moderation case not found',
        );
      return updated;
    });
    await this.notifyModeration(result, action);
    return this.toCaseDto(result);
  }

  private moderationTransition(
    status: LessonModerationCaseStatus,
    action: ModerationAction,
  ) {
    const active = ACTIVE_CASE_STATUSES.includes(
      status as (typeof ACTIVE_CASE_STATUSES)[number],
    );
    if (!active)
      throw this.conflict(
        'MODERATION_CASE_RESOLVED',
        'Moderation case is already resolved',
      );
    if (
      action === 'approve' &&
      status !== LessonModerationCaseStatus.UNDER_REVIEW
    )
      throw this.conflict(
        'MODERATION_INVALID_TRANSITION',
        'Only a reviewed lesson can be approved',
      );
    if (action === 'hide') {
      if (status !== LessonModerationCaseStatus.REPORTED)
        throw this.conflict(
          'MODERATION_INVALID_TRANSITION',
          'Only a reported lesson can be hidden',
        );
      return {
        caseStatus: LessonModerationCaseStatus.UNDER_REVIEW,
        lessonStatus: LessonModerationStatus.UNDER_REVIEW,
        auditAction: AdminAuditAction.LESSON_HIDDEN,
        resolved: false,
      };
    }
    if (action === 'dismiss') {
      if (status === LessonModerationCaseStatus.CHANGES_REQUESTED)
        throw this.conflict(
          'MODERATION_INVALID_TRANSITION',
          'A changes request cannot be dismissed',
        );
      return {
        caseStatus: LessonModerationCaseStatus.DISMISSED,
        lessonStatus: LessonModerationStatus.CLEAR,
        auditAction: AdminAuditAction.LESSON_REPORT_DISMISSED,
        resolved: true,
      };
    }
    if (action === 'request-changes') {
      if (status === LessonModerationCaseStatus.CHANGES_REQUESTED)
        throw this.conflict(
          'MODERATION_INVALID_TRANSITION',
          'Changes have already been requested',
        );
      return {
        caseStatus: LessonModerationCaseStatus.CHANGES_REQUESTED,
        lessonStatus: LessonModerationStatus.CHANGES_REQUESTED,
        auditAction: AdminAuditAction.LESSON_CHANGES_REQUESTED,
        resolved: false,
      };
    }
    if (action === 'approve')
      return {
        caseStatus: LessonModerationCaseStatus.APPROVED,
        lessonStatus: LessonModerationStatus.CLEAR,
        auditAction: AdminAuditAction.LESSON_APPROVED,
        resolved: true,
      };
    return {
      caseStatus: LessonModerationCaseStatus.REMOVED,
      lessonStatus: LessonModerationStatus.REMOVED,
      auditAction: AdminAuditAction.LESSON_REMOVED,
      resolved: true,
    };
  }

  private async notifyModeration(
    record: ModerationCaseRecord,
    action: ModerationAction,
  ): Promise<void> {
    const notifications: CreateNotificationInput[] = [];
    if (
      action === 'request-changes' ||
      action === 'approve' ||
      action === 'remove'
    ) {
      const type =
        action === 'request-changes'
          ? NotificationType.LESSON_MODERATION_CHANGES_REQUESTED
          : action === 'approve'
            ? NotificationType.LESSON_MODERATION_APPROVED
            : NotificationType.LESSON_MODERATION_REMOVED;
      notifications.push({
        recipientId: record.lesson.teacherId,
        type,
        deduplicationKey: `${type}:${record.id}:${record.editVersion}`,
        payload: {
          lessonId: record.lesson.id,
          moderationCaseId: record.id,
          lessonTitle: record.lesson.title,
        },
      });
    }
    if (action === 'dismiss' || action === 'approve' || action === 'remove') {
      const seen = new Set<string>();
      for (const report of record.reports) {
        if (seen.has(report.reporterId)) continue;
        seen.add(report.reporterId);
        notifications.push({
          recipientId: report.reporterId,
          subjectStudentId: report.subjectStudentId,
          type: NotificationType.LESSON_REPORT_RESOLVED,
          deduplicationKey: `LESSON_REPORT_RESOLVED:${record.id}:${report.reporterId}`,
          payload: {
            lessonId: record.lesson.id,
            moderationCaseId: record.id,
            outcome: action === 'dismiss' ? 'NOT_CONFIRMED' : 'ACTION_TAKEN',
          },
        });
      }
    }
    await this.notifications.createMany(notifications);
  }

  private assertAdmin(user: AuthUser): void {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only administrators may use this endpoint',
      });
  }

  private assertMutableUser(
    actor: AuthUser,
    target: { id: string; role: UserRole } | null,
  ): void {
    if (!target) throw this.notFound('USER_NOT_FOUND', 'User not found');
    if (target.id === actor.id || target.role === UserRole.ADMIN)
      throw new ForbiddenException({
        code: 'ADMIN_USER_PROTECTED',
        message: 'Administrator accounts cannot be changed here',
      });
  }

  private toUserDto(record: UserRecord): AdminUserDto {
    return new AdminUserDto({
      id: record.id,
      email: record.email,
      role: record.role,
      status: record.status,
      displayName: record.profile?.displayName ?? record.email.split('@')[0],
      avatarUrl: record.profile?.avatarUrl ?? null,
      subjectArea: record.profile?.subjectArea ?? null,
      preferredLocale: record.profile?.preferredLocale ?? 'UK',
      classId: record.studentClass?.id ?? null,
      className: record.studentClass?.name ?? null,
      emailVerifiedAt: record.emailVerifiedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      stats: new AdminUserStatsDto({
        classes: record._count.taughtClasses,
        lessons: record._count.authoredLessons,
        assignments: record._count.authoredAssignments,
        tests: record._count.authoredTests,
        children: record._count.parentLinks,
        guardians: record._count.childLinks,
      }),
    });
  }

  private toClassDto(record: {
    id: string;
    name: string;
    teacherId: string;
    createdAt: Date;
    updatedAt: Date;
    teacher: { email: string; profile: { displayName: string } | null };
    _count: { students: number; lessonLinks: number; testReleases: number };
  }): AdminClassDto {
    return new AdminClassDto({
      id: record.id,
      name: record.name,
      teacherId: record.teacherId,
      teacherName:
        record.teacher.profile?.displayName ??
        record.teacher.email.split('@')[0],
      teacherEmail: record.teacher.email,
      studentCount: record._count.students,
      lessonCount: record._count.lessonLinks,
      releaseCount: record._count.testReleases,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private toCaseDto(record: ModerationCaseRecord): LessonModerationCaseDto {
    return new LessonModerationCaseDto({
      id: record.id,
      lessonId: record.lesson.id,
      lessonTitle: record.lesson.title,
      teacherId: record.lesson.teacherId,
      teacherName: record.lesson.teacher.profile?.displayName ?? 'Teacher',
      status: record.status,
      lessonModerationStatus: record.lesson.moderationStatus,
      lessonStatus: record.lesson.status,
      reportCount: record.reports.length,
      editVersion: record.editVersion,
      resolutionNote: record.resolutionNote,
      initialSnapshot: this.jsonObject(record.initialSnapshot) ?? {},
      currentSnapshot: this.lessonSnapshot(record.lesson),
      reports: record.reports.map(
        (report) =>
          new LessonReportDto({
            id: report.id,
            category: report.category,
            details: report.details,
            reporterId: report.reporterId,
            reporterName: report.reporter.profile?.displayName ?? 'User',
            reporterRole: report.reporter.role,
            subjectStudentId: report.subjectStudentId,
            subjectStudentName:
              report.subjectStudent.profile?.displayName ?? 'Student',
            classId: report.classId,
            className: report.class.name,
            createdAt: report.createdAt,
          }),
      ),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private lessonSnapshot(lesson: {
    title: string;
    summary: string;
    content: string;
    contentLocale: string;
    estimatedMinutes: number | null;
    updatedAt: Date;
  }): Prisma.InputJsonObject {
    return {
      title: lesson.title,
      summary: lesson.summary,
      content: lesson.content,
      contentLocale: lesson.contentLocale,
      ...(lesson.estimatedMinutes === null
        ? {}
        : { estimatedMinutes: lesson.estimatedMinutes }),
      updatedAt: lesson.updatedAt.toISOString(),
    };
  }

  private jsonObject(
    value: Prisma.JsonValue | null | undefined,
  ): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : null;
  }

  private toSuspensionAppealDto(
    record: SuspensionAppealRecord,
  ): AdminSuspensionAppealDto {
    return new AdminSuspensionAppealDto({
      id: record.id,
      userId: record.userId,
      displayName: record.user.profile?.displayName ?? 'User',
      email: record.user.email,
      role: record.user.role,
      userStatus: record.user.status,
      status: record.status,
      suspensionReason: record.suspensionAuditLog.reason,
      suspendedAt: record.suspensionAuditLog.createdAt,
      message: record.message,
      resolutionNote: record.resolutionNote,
      reviewedAt: record.reviewedAt,
      createdAt: record.createdAt,
    });
  }

  private async sendAppealDecision(
    user: { email: string; profile: { preferredLocale: Locale } | null },
    approved: boolean,
    resolutionNote: string,
  ): Promise<void> {
    try {
      await this.mail.sendSuspensionAppealDecision(
        user.email,
        approved,
        resolutionNote,
        user.profile?.preferredLocale ?? Locale.UK,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Could not send suspension appeal decision to ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private beforeCursor(cursor: PageCursor) {
    return {
      OR: [
        { createdAt: { lt: new Date(cursor.createdAt) } },
        { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
      ],
    };
  }

  private cursorFor(
    record: { createdAt: Date; id: string } | undefined,
  ): string | null {
    return record
      ? Buffer.from(
          JSON.stringify({
            createdAt: record.createdAt.toISOString(),
            id: record.id,
          }),
        ).toString('base64url')
      : null;
  }

  private decodeCursor(value?: string): PageCursor | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as Partial<PageCursor>;
      if (
        !parsed.createdAt ||
        !parsed.id ||
        Number.isNaN(new Date(parsed.createdAt).getTime())
      )
        throw new Error();
      return { createdAt: parsed.createdAt, id: parsed.id };
    } catch {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'Cursor is invalid',
      });
    }
  }

  private notFound(code: string, message: string) {
    return new NotFoundException({ code, message });
  }
  private conflict(code: string, message: string) {
    return new ConflictException({ code, message });
  }
}
