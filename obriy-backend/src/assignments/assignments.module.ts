import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { AssignmentImagesController } from './assignment-images.controller';
import { AssignmentImagesService } from './assignment-images.service';
import { CloudinaryMediaService } from './cloudinary-media.service';

@Module({
  controllers: [AssignmentsController, AssignmentImagesController],
  providers: [
    AssignmentsService,
    AssignmentImagesService,
    CloudinaryMediaService,
  ],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
