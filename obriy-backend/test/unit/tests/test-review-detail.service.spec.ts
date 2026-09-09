import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../src/common/types/auth-user.type';
import type { TestAttemptScoringService } from '../../../src/tests/test-attempt-scoring.service';
import { TestReviewsService } from '../../../src/tests/test-reviews.service';

describe('TestReviewsService direct attempt access', () => {
  const findFirst = jest.fn();
  const service = new TestReviewsService(
    { testAttempt: { findFirst } } as unknown as PrismaService,
    {} as TestAttemptScoringService,
  );
  const teacher: AuthUser = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    status: UserStatus.ACTIVE,
  };

  afterEach(() => jest.resetAllMocks());

  it('rejects non-teachers before querying attempts', async () => {
    await expect(
      service.findLessonReview(
        { ...teacher, role: UserRole.STUDENT },
        'lesson-1',
        'attempt-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns not found when the attempt is not owned by the teacher', async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      service.findLessonReview(teacher, 'lesson-1', 'foreign-attempt'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledTimes(1);
    const accessQuery = JSON.stringify(findFirst.mock.calls[0]);
    expect(accessQuery).toContain('"id":"foreign-attempt"');
    expect(accessQuery).toContain('"lessonId":"lesson-1"');
    expect(accessQuery).toContain(`"teacherId":"${teacher.id}"`);
  });
});
