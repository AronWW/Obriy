import { TestLatePolicy, TestReleaseStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { TestReleaseLifecycleService } from '../../../src/tests/test-release-lifecycle.service';

describe('TestReleaseLifecycleService', () => {
  const updateMany = jest.fn();
  const transaction = jest.fn((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  );
  const prisma = {
    testRelease: { updateMany },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new TestReleaseLifecycleService(prisma);

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
  });

  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });
  });

  afterEach(() => jest.clearAllMocks());

  it('activates due scheduled releases and closes only overdue DISALLOW releases', async () => {
    await service.synchronizeClass('class-1');

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        classId: 'class-1',
        status: TestReleaseStatus.SCHEDULED,
        availableFrom: { lte: new Date('2026-09-10T12:00:00.000Z') },
      },
      data: { status: TestReleaseStatus.ACTIVE },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        classId: 'class-1',
        status: TestReleaseStatus.ACTIVE,
        latePolicy: TestLatePolicy.DISALLOW,
        dueAt: { lte: new Date('2026-09-10T12:00:00.000Z') },
      },
      data: {
        status: TestReleaseStatus.CLOSED,
        closedAt: new Date('2026-09-10T12:00:00.000Z'),
      },
    });
  });
});
