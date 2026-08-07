import { Module } from '@nestjs/common';
import {
  ClassLessonsController,
  LessonsController,
  StudentLessonsController,
} from './lessons.controller';
import { LessonsService } from './lessons.service';
import {
  LessonTasksController,
  StudentLessonTaskSubmissionsController,
} from './lesson-tasks.controller';
import { LessonTasksService } from './lesson-tasks.service';

@Module({
  // The static student route must be registered before the dynamic
  // `classes/:classId/lessons` route.
  controllers: [
    LessonsController,
    LessonTasksController,
    StudentLessonsController,
    StudentLessonTaskSubmissionsController,
    ClassLessonsController,
  ],
  providers: [LessonsService, LessonTasksService],
})
export class LessonsModule {}
