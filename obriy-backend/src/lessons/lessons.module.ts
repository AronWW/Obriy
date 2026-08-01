import { Module } from '@nestjs/common';
import {
  ClassLessonsController,
  LessonsController,
} from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  controllers: [LessonsController, ClassLessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
