import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import {
  AssignmentAttemptReviewsController,
  LessonAssignmentReviewsController,
} from './assignment-reviews.controller';
import { AssignmentReviewsService } from './assignment-reviews.service';
import { LessonAssignmentsController } from './lesson-assignments.controller';
import { LessonAssignmentsService } from './lesson-assignments.service';
import {
  StudentAssignmentAttemptsController,
  StudentLessonAssignmentsController,
} from './student-assignments.controller';
import { StudentAssignmentsService } from './student-assignments.service';

@Module({
  controllers: [
    AssignmentsController,
    LessonAssignmentsController,
    StudentLessonAssignmentsController,
    StudentAssignmentAttemptsController,
    LessonAssignmentReviewsController,
    AssignmentAttemptReviewsController,
  ],
  providers: [
    AssignmentsService,
    LessonAssignmentsService,
    StudentAssignmentsService,
    AssignmentReviewsService,
  ],
  exports: [AssignmentsService, LessonAssignmentsService],
})
export class AssignmentsModule {}
