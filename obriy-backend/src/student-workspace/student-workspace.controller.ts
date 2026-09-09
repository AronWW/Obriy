import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  StudentDashboardDto,
  StudentTasksPageDto,
} from './dto/student-workspace.dto';
import { StudentTasksQueryDto } from './dto/student-workspace-query.dto';
import { StudentWorkspaceService } from './student-workspace.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Student workspace')
@ApiBearerAuth()
@Controller('student')
export class StudentWorkspaceController {
  constructor(private readonly workspaceService: StudentWorkspaceService) {}

  @ApiOkResponse({ type: StudentDashboardDto })
  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthUser): Promise<StudentDashboardDto> {
    return this.workspaceService.getDashboard(user);
  }

  @ApiOkResponse({ type: StudentTasksPageDto })
  @Get('tasks')
  getTasks(
    @CurrentUser() user: AuthUser,
    @Query() query: StudentTasksQueryDto,
  ): Promise<StudentTasksPageDto> {
    return this.workspaceService.getTasks(user, query);
  }
}
