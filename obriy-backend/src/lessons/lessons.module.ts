import { Module } from '@nestjs/common';
import {
  ClassLessonsController,
  LessonsController,
  StudentLessonsController,
} from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  // The static student route must be registered before the dynamic
  // `classes/:classId/lessons` route.
  controllers: [
    LessonsController,
    StudentLessonsController,
    ClassLessonsController,
  ],
  providers: [LessonsService],
})
export class LessonsModule {}
