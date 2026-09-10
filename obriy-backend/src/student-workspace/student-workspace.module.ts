import { Module } from '@nestjs/common';
import { TestsModule } from '../tests/tests.module';
import { StudentWorkspaceController } from './student-workspace.controller';
import { StudentWorkspaceService } from './student-workspace.service';

@Module({
  imports: [TestsModule],
  controllers: [StudentWorkspaceController],
  providers: [StudentWorkspaceService],
})
export class StudentWorkspaceModule {}
