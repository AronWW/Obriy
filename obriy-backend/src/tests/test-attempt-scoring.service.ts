import { ConflictException, Injectable } from '@nestjs/common';
import {
  Prisma,
  TestAnswerStatus,
  TestAttemptStatus,
  TestLatePolicy,
  TestScorePolicy,
  TestStudentStatus,
} from '@prisma/client';
import { GamificationService } from '../gamification/gamification.service';
import type { GamificationRewardDto } from '../gamification/dto/gamification.dto';

@Injectable()
export class TestAttemptScoringService {
  constructor(private readonly gamification: GamificationService) {}

  async finalize(
    transaction: Prisma.TransactionClient,
    attemptId: string,
    gradedAt = new Date(),
  ): Promise<GamificationRewardDto | null> {
    const attempt = await transaction.testAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        maxPoints: true,
        isLate: true,
        submittedAt: true,
        studentState: {
          select: {
            id: true,
            bestPoints: true,
            bestPercent: true,
            release: {
              select: {
                passingPercent: true,
                scorePolicy: true,
                latePolicy: true,
                latePenaltyPercent: true,
              },
            },
          },
        },
        answers: { select: { status: true, scorePoints: true } },
      },
    });
    if (!attempt) {
      throw new ConflictException({
        code: 'TEST_ATTEMPT_NOT_FOUND',
        message: 'Test attempt not found',
      });
    }
    if (
      attempt.answers.some(
        (answer) => answer.status !== TestAnswerStatus.GRADED,
      )
    ) {
      throw new ConflictException({
        code: 'TEST_ATTEMPT_REVIEW_INCOMPLETE',
        message:
          'Every test answer must be graded before finalizing the attempt',
      });
    }

    const release = attempt.studentState.release;
    const maxPoints = Number(attempt.maxPoints);
    const rawScorePoints = attempt.answers.reduce(
      (sum, answer) => sum + Number(answer.scorePoints ?? 0),
      0,
    );
    const latePenalty =
      attempt.isLate && release.latePolicy === TestLatePolicy.ALLOW_WITH_PENALTY
        ? Number(release.latePenaltyPercent ?? 0)
        : 0;
    const scorePoints = roundScore(
      rawScorePoints * Math.max(0, 1 - latePenalty / 100),
    );
    const scorePercent =
      maxPoints > 0 ? roundScore((scorePoints / maxPoints) * 100) : 0;
    const isPassed = scorePercent >= Number(release.passingPercent);

    await transaction.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status: TestAttemptStatus.GRADED,
        scorePoints,
        scorePercent,
        isPassed,
        pendingReviewCount: 0,
        submittedAt: attempt.submittedAt ?? gradedAt,
        gradedAt,
      },
    });

    const previousBestPercent =
      attempt.studentState.bestPercent === null
        ? null
        : Number(attempt.studentState.bestPercent);
    const previousBestPoints =
      attempt.studentState.bestPoints === null
        ? null
        : Number(attempt.studentState.bestPoints);
    const isNewBest =
      previousBestPercent === null || scorePercent > previousBestPercent;
    const bestPercent = isNewBest ? scorePercent : previousBestPercent;
    const bestPoints = isNewBest ? scorePoints : previousBestPoints;
    const displayedPercent =
      release.scorePolicy === TestScorePolicy.BEST ? bestPercent : scorePercent;
    const displayedPoints =
      release.scorePolicy === TestScorePolicy.BEST ? bestPoints : scorePoints;
    const passedByPolicy =
      displayedPercent !== null &&
      displayedPercent >= Number(release.passingPercent);
    await transaction.testStudentState.update({
      where: { id: attempt.studentState.id },
      data: {
        status: passedByPolicy
          ? TestStudentStatus.COMPLETED
          : TestStudentStatus.NEEDS_REVISION,
        scorePoints: displayedPoints,
        scorePercent: displayedPercent,
        bestPoints,
        bestPercent,
        submittedAt: attempt.submittedAt ?? gradedAt,
        completedAt: passedByPolicy ? gradedAt : null,
        lastActivityAt: gradedAt,
      },
    });
    return isPassed
      ? this.gamification.awardFinalizedAttempt(transaction, {
          attemptId: attempt.id,
          awardedAt: gradedAt,
        })
      : null;
  }
}

function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
