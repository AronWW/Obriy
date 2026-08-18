import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module';
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
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

@Module({
  imports: [AssignmentsModule],
  controllers: [
    TestsController,
    LessonTestsController,
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
  ],
  exports: [TestsService, LessonTestsService],
})
export class TestsModule {}
