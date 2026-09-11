import type { GamificationRewardDto } from '../gamification/dto/gamification.dto';

export const notificationEvents = {
  releasePublished: 'test.release.published',
  releaseAvailable: 'test.release.available',
  reviewRequired: 'test.attempt.review-required',
  attemptFinalized: 'test.attempt.finalized',
} as const;

export interface ReleaseNotificationEvent {
  releaseId: string;
}

export interface AttemptNotificationEvent {
  attemptId: string;
  reward?: GamificationRewardDto | null;
}
