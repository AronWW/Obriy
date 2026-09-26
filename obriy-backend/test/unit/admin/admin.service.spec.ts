import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  LessonModerationCaseStatus,
  LessonModerationStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { PrismaService } from '../../../prisma/prisma.service';
import { AdminService } from '../../../src/admin/admin.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import type { NotificationsService } from '../../../src/notifications/notifications.service';
import type { MailService } from '../../../src/mail/mail.service';

describe('AdminService moderation and access rules', () => {
  const admin: AuthUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };
  const teacher: AuthUser = {
    ...admin,
    id: 'teacher-1',
    role: UserRole.TEACHER,
  };
  const service = new AdminService(
    {} as PrismaService,
    { emit: jest.fn() } as unknown as EventEmitter2,
    { createMany: jest.fn() } as unknown as NotificationsService,
    { sendSuspensionAppealDecision: jest.fn() } as unknown as MailService,
  );

  const transition = (
    status: LessonModerationCaseStatus,
    action: 'hide' | 'dismiss' | 'request-changes' | 'approve' | 'remove',
  ) =>
    (
      service as unknown as {
        moderationTransition: (
          current: LessonModerationCaseStatus,
          next: typeof action,
        ) => { lessonStatus: LessonModerationStatus; resolved: boolean };
      }
    ).moderationTransition(status, action);

  it('rejects non-admin dashboard access before any database work', async () => {
    await expect(service.dashboard(teacher)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('keeps a report visible until an explicit hide action', () => {
    const hidden = transition(LessonModerationCaseStatus.REPORTED, 'hide');
    expect(hidden).toMatchObject({
      lessonStatus: LessonModerationStatus.UNDER_REVIEW,
      resolved: false,
    });
  });

  it('supports request changes, resubmitted approval and soft removal states', () => {
    expect(
      transition(LessonModerationCaseStatus.UNDER_REVIEW, 'request-changes'),
    ).toMatchObject({
      lessonStatus: LessonModerationStatus.CHANGES_REQUESTED,
      resolved: false,
    });
    expect(
      transition(LessonModerationCaseStatus.UNDER_REVIEW, 'approve'),
    ).toMatchObject({
      lessonStatus: LessonModerationStatus.CLEAR,
      resolved: true,
    });
    expect(
      transition(LessonModerationCaseStatus.CHANGES_REQUESTED, 'remove'),
    ).toMatchObject({
      lessonStatus: LessonModerationStatus.REMOVED,
      resolved: true,
    });
  });

  it('does not let an open changes request become visible through dismiss', () => {
    expect(() =>
      transition(LessonModerationCaseStatus.CHANGES_REQUESTED, 'dismiss'),
    ).toThrow(ConflictException);
  });

  it('requires resubmission before approval and rejects resolved cases', () => {
    expect(() =>
      transition(LessonModerationCaseStatus.REPORTED, 'approve'),
    ).toThrow(ConflictException);
    expect(() =>
      transition(LessonModerationCaseStatus.APPROVED, 'remove'),
    ).toThrow(ConflictException);
  });

  it('protects the acting admin and every other admin from status changes', () => {
    const privateService = service as unknown as {
      assertMutableUser: (
        actor: AuthUser,
        target: { id: string; role: UserRole },
      ) => void;
    };
    const assertMutable = (
      actor: AuthUser,
      target: { id: string; role: UserRole },
    ) => privateService.assertMutableUser(actor, target);
    expect(() =>
      assertMutable(admin, { id: admin.id, role: UserRole.ADMIN }),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertMutable(admin, { id: 'admin-2', role: UserRole.ADMIN }),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertMutable(admin, { id: teacher.id, role: UserRole.TEACHER }),
    ).not.toThrow();
  });
});
