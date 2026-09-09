import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { TeacherDashboardDto } from './dto/teacher-dashboard.dto';
import { TeacherDashboardService } from './teacher-dashboard.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Teacher dashboard')
@ApiBearerAuth()
@Controller('teacher/dashboard')
export class TeacherDashboardController {
  constructor(private readonly dashboardService: TeacherDashboardService) {}

  @ApiOkResponse({ type: TeacherDashboardDto })
  @Get()
  getDashboard(@CurrentUser() user: AuthUser): Promise<TeacherDashboardDto> {
    return this.dashboardService.getDashboard(user);
  }
}
