import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module';
import { GamificationModule } from '../gamification/gamification.module';
import { LessonTestsController } from './lesson-tests.controller';
import { LessonTestsService } from './lesson-tests.service';
import {
  StudentLessonTestsController,
  StudentTestAttemptsController,
  StudentTestReleasesController,
} from './student-tests.controller';
import { StudentTestsService } from './student-tests.service';
import { TestAttemptScoringService } from './test-attempt-scoring.service';
import {
  LessonTestReviewsController,
  TestAnswerReviewsController,
} from './test-reviews.controller';
import { TestReviewsService } from './test-reviews.service';
import {
  TeacherLessonTestReleasesController,
  TeacherTestReleasesController,
} from './teacher-test-releases.controller';
import { TeacherTestReleasesService } from './teacher-test-releases.service';
import { TestReleaseLifecycleService } from './test-release-lifecycle.service';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

@Module({
  imports: [AssignmentsModule, GamificationModule],
  controllers: [
    TestsController,
    LessonTestsController,
    TeacherLessonTestReleasesController,
    TeacherTestReleasesController,
    StudentLessonTestsController,
    StudentTestReleasesController,
    StudentTestAttemptsController,
    LessonTestReviewsController,
    TestAnswerReviewsController,
  ],
  providers: [
    TestsService,
    LessonTestsService,
    StudentTestsService,
    TestAttemptScoringService,
    TestReviewsService,
    TeacherTestReleasesService,
    TestReleaseLifecycleService,
  ],
  exports: [
    TestsService,
    LessonTestsService,
    StudentTestsService,
    TestReleaseLifecycleService,
  ],
})
export class TestsModule {}
