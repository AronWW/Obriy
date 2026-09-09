import { ForbiddenException } from '@nestjs/common';
import {
  AssignmentStatus,
  AssignmentType,
  LessonStatus,
  TestAttemptStatus,
  TestStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import { TeacherDashboardService } from '../../../src/teacher-dashboard/teacher-dashboard.service';

describe('TeacherDashboardService', () => {
  const classCount = jest.fn();
  const userCount = jest.fn();
  const lessonCount = jest.fn();
  const lessonFindMany = jest.fn();
  const assignmentCount = jest.fn();
  const assignmentFindMany = jest.fn();
  const testCount = jest.fn();
  const testFindMany = jest.fn();
  const testAttemptCount = jest.fn();
  const testAttemptFindMany = jest.fn();
  const transaction = jest.fn((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  );
  const prisma = {
    class: { count: classCount },
    user: { count: userCount },
    lesson: { count: lessonCount, findMany: lessonFindMany },
    assignment: { count: assignmentCount, findMany: assignmentFindMany },
    test: { count: testCount, findMany: testFindMany },
    testAttempt: {
      count: testAttemptCount,
      findMany: testAttemptFindMany,
    },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new TeacherDashboardService(prisma);
  const teacher: AuthUser = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
  };

  afterEach(() => jest.clearAllMocks());

  it('rejects a non-teacher without reading dashboard data', async () => {
    await expect(
      service.getDashboard({ ...teacher, role: UserRole.STUDENT }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns owned active totals, drafts, pending reviews and recent items', async () => {
    const updatedAt = new Date('2026-09-08T11:00:00.000Z');
    const submittedAt = new Date('2026-09-09T09:30:00.000Z');
    classCount.mockResolvedValue(2);
    userCount.mockResolvedValue(17);
    lessonCount.mockResolvedValueOnce(6).mockResolvedValueOnce(2);
    assignmentCount.mockResolvedValueOnce(9).mockResolvedValueOnce(3);
    testCount.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    testAttemptCount.mockResolvedValue(7);
    testAttemptFindMany.mockResolvedValue([
      {
        id: 'attempt-1',
        pendingReviewCount: 2,
        submittedAt,
        studentState: {
          student: {
            id: 'student-1',
            email: 'student@example.com',
            profile: { displayName: 'Marta' },
          },
          release: {
            lessonId: 'lesson-1',
            lesson: { title: 'Kyivan Rus' },
            class: { id: 'class-1', name: 'History club' },
            revision: { title: 'Source analysis' },
          },
        },
      },
    ]);
    lessonFindMany.mockResolvedValue([
      {
        id: 'lesson-1',
        title: 'Kyivan Rus',
        status: LessonStatus.PUBLISHED,
        updatedAt,
        _count: { classLinks: 2 },
      },
    ]);
    assignmentFindMany.mockResolvedValue([
      {
        id: 'assignment-1',
        type: AssignmentType.WRITTEN,
        status: AssignmentStatus.DRAFT,
        updatedAt,
        revisions: [{ title: 'Compare sources' }],
      },
    ]);
    testFindMany.mockResolvedValue([
      {
        id: 'test-1',
        status: TestStatus.PUBLISHED,
        updatedAt,
        revisions: [{ title: 'Topic check', _count: { items: 5 } }],
      },
    ]);

    await expect(service.getDashboard(teacher)).resolves.toMatchObject({
      stats: {
        classes: { total: 2, studentCount: 17 },
        lessons: { total: 6, drafts: 2 },
        assignments: { total: 9, drafts: 3 },
        tests: { total: 4, drafts: 1 },
        pendingReviews: 7,
      },
      pendingReviews: [
        {
          attemptId: 'attempt-1',
          lessonId: 'lesson-1',
          studentName: 'Marta',
          pendingReviewCount: 2,
          submittedAt,
        },
      ],
      recent: {
        lessons: [{ id: 'lesson-1', classCount: 2 }],
        assignments: [{ id: 'assignment-1', title: 'Compare sources' }],
        tests: [{ id: 'test-1', title: 'Topic check', itemCount: 5 }],
      },
    });

    expect(classCount).toHaveBeenCalledWith({
      where: { teacherId: teacher.id },
    });
    expect(lessonCount).toHaveBeenCalledWith({
      where: {
        teacherId: teacher.id,
        status: { not: LessonStatus.ARCHIVED },
      },
    });
    expect(testAttemptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
    const pendingReviewCall = JSON.stringify(testAttemptFindMany.mock.calls[0]);
    expect(pendingReviewCall).toContain(TestAttemptStatus.AWAITING_REVIEW);
    expect(pendingReviewCall).toContain(`"teacherId":"${teacher.id}"`);
    expect(pendingReviewCall).toContain('"lessonId":{"not":null}');
    expect(lessonFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
    expect(assignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
    expect(testFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });
});
