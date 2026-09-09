import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AssignmentRevisionStatus,
  AssignmentStatus,
  LessonStatus,
  TestAttemptStatus,
  TestRevisionStatus,
  TestStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  TeacherDashboardClassStatsDto,
  TeacherDashboardDto,
  TeacherDashboardRecentAssignmentDto,
  TeacherDashboardRecentDto,
  TeacherDashboardRecentLessonDto,
  TeacherDashboardRecentTestDto,
  TeacherDashboardResourceStatsDto,
  TeacherDashboardReviewDto,
  TeacherDashboardStatsDto,
} from './dto/teacher-dashboard.dto';

const RECENT_LIMIT = 3;
const REVIEW_LIMIT = 5;

@Injectable()
export class TeacherDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(user: AuthUser): Promise<TeacherDashboardDto> {
    this.assertTeacher(user);
    const teacherId = user.id;
    const pendingReviewWhere = {
      status: TestAttemptStatus.AWAITING_REVIEW,
      pendingReviewCount: { gt: 0 },
      studentState: {
        release: {
          lessonId: { not: null },
          lesson: { teacherId },
          test: { teacherId },
        },
      },
    } as const;

    const [
      classCount,
      studentCount,
      lessonCount,
      lessonDraftCount,
      assignmentCount,
      assignmentDraftCount,
      testCount,
      testDraftCount,
      pendingReviewCount,
      pendingReviews,
      recentLessons,
      recentAssignments,
      recentTests,
    ] = await this.prisma.$transaction([
      this.prisma.class.count({ where: { teacherId } }),
      this.prisma.user.count({ where: { studentClass: { teacherId } } }),
      this.prisma.lesson.count({
        where: { teacherId, status: { not: LessonStatus.ARCHIVED } },
      }),
      this.prisma.lesson.count({
        where: { teacherId, status: LessonStatus.DRAFT },
      }),
      this.prisma.assignment.count({
        where: { teacherId, status: { not: AssignmentStatus.ARCHIVED } },
      }),
      this.prisma.assignment.count({
        where: { teacherId, status: AssignmentStatus.DRAFT },
      }),
      this.prisma.test.count({
        where: { teacherId, status: { not: TestStatus.ARCHIVED } },
      }),
      this.prisma.test.count({
        where: { teacherId, status: TestStatus.DRAFT },
      }),
      this.prisma.testAttempt.count({ where: pendingReviewWhere }),
      this.prisma.testAttempt.findMany({
        where: pendingReviewWhere,
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: REVIEW_LIMIT,
        select: {
          id: true,
          pendingReviewCount: true,
          submittedAt: true,
          studentState: {
            select: {
              student: {
                select: {
                  id: true,
                  email: true,
                  profile: { select: { displayName: true } },
                },
              },
              release: {
                select: {
                  lessonId: true,
                  lesson: { select: { title: true } },
                  class: { select: { id: true, name: true } },
                  revision: { select: { title: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.lesson.findMany({
        where: { teacherId, status: { not: LessonStatus.ARCHIVED } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: RECENT_LIMIT,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          _count: { select: { classLinks: true } },
        },
      }),
      this.prisma.assignment.findMany({
        where: { teacherId, status: { not: AssignmentStatus.ARCHIVED } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: RECENT_LIMIT,
        select: {
          id: true,
          type: true,
          status: true,
          updatedAt: true,
          revisions: {
            where: {
              status: {
                in: [
                  AssignmentRevisionStatus.DRAFT,
                  AssignmentRevisionStatus.PUBLISHED,
                ],
              },
            },
            orderBy: { version: 'desc' },
            take: 1,
            select: { title: true },
          },
        },
      }),
      this.prisma.test.findMany({
        where: { teacherId, status: { not: TestStatus.ARCHIVED } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: RECENT_LIMIT,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          revisions: {
            where: {
              status: {
                in: [TestRevisionStatus.DRAFT, TestRevisionStatus.PUBLISHED],
              },
            },
            orderBy: { version: 'desc' },
            take: 1,
            select: { title: true, _count: { select: { items: true } } },
          },
        },
      }),
    ]);

    return new TeacherDashboardDto({
      stats: new TeacherDashboardStatsDto({
        classes: new TeacherDashboardClassStatsDto({
          total: classCount,
          studentCount,
        }),
        lessons: new TeacherDashboardResourceStatsDto({
          total: lessonCount,
          drafts: lessonDraftCount,
        }),
        assignments: new TeacherDashboardResourceStatsDto({
          total: assignmentCount,
          drafts: assignmentDraftCount,
        }),
        tests: new TeacherDashboardResourceStatsDto({
          total: testCount,
          drafts: testDraftCount,
        }),
        pendingReviews: pendingReviewCount,
      }),
      pendingReviews: pendingReviews.flatMap((attempt) => {
        const release = attempt.studentState.release;
        if (!release.lessonId || !release.lesson) return [];
        return [
          new TeacherDashboardReviewDto({
            attemptId: attempt.id,
            lessonId: release.lessonId,
            lessonTitle: release.lesson.title,
            testTitle: release.revision.title,
            studentId: attempt.studentState.student.id,
            studentName:
              attempt.studentState.student.profile?.displayName ??
              attempt.studentState.student.email,
            classId: release.class.id,
            className: release.class.name,
            pendingReviewCount: attempt.pendingReviewCount,
            submittedAt: attempt.submittedAt,
          }),
        ];
      }),
      recent: new TeacherDashboardRecentDto({
        lessons: recentLessons.map(
          (lesson) =>
            new TeacherDashboardRecentLessonDto({
              id: lesson.id,
              title: lesson.title,
              status: lesson.status,
              classCount: lesson._count.classLinks,
              updatedAt: lesson.updatedAt,
            }),
        ),
        assignments: recentAssignments.map(
          (assignment) =>
            new TeacherDashboardRecentAssignmentDto({
              id: assignment.id,
              title: assignment.revisions[0]?.title ?? '',
              type: assignment.type,
              status: assignment.status,
              updatedAt: assignment.updatedAt,
            }),
        ),
        tests: recentTests.map(
          (test) =>
            new TeacherDashboardRecentTestDto({
              id: test.id,
              title: test.revisions[0]?.title ?? '',
              status: test.status,
              itemCount: test.revisions[0]?._count.items ?? 0,
              updatedAt: test.updatedAt,
            }),
        ),
      }),
    });
  }

  private assertTeacher(user: AuthUser): void {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: 'Only teachers can view the teacher dashboard',
      });
    }
  }
}
