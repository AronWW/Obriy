import { Module } from '@nestjs/common';
import { TestsModule } from '../tests/tests.module';
import { ParentDashboardController } from './parent-dashboard.controller';
import { ParentDashboardService } from './parent-dashboard.service';

@Module({
  imports: [TestsModule],
  controllers: [ParentDashboardController],
  providers: [ParentDashboardService],
})
export class ParentDashboardModule {}
