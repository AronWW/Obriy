import { Module } from '@nestjs/common';
import { ParentLinksController } from './parent-links.controller';
import { ParentLinksService } from './parent-links.service';

@Module({
  controllers: [ParentLinksController],
  providers: [ParentLinksService],
})
export class ParentLinksModule {}
