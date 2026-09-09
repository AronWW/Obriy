import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  TeacherClassAnalyticsDto,
  TeacherStudentAnalyticsDto,
} from './dto/teacher-analytics.dto';
import { TeacherAnalyticsService } from './teacher-analytics.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Teacher analytics')
@ApiBearerAuth()
@Controller('teacher/analytics/classes')
export class TeacherAnalyticsController {
  constructor(private readonly analyticsService: TeacherAnalyticsService) {}

  @ApiOkResponse({ type: TeacherClassAnalyticsDto })
  @Get(':classId')
  getClassAnalytics(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
  ): Promise<TeacherClassAnalyticsDto> {
    return this.analyticsService.getClassAnalytics(user, classId);
  }

  @ApiOkResponse({ type: TeacherStudentAnalyticsDto })
  @Get(':classId/students/:studentId')
  getStudentAnalytics(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
    @Param('studentId') studentId: string,
  ): Promise<TeacherStudentAnalyticsDto> {
    return this.analyticsService.getStudentAnalytics(user, classId, studentId);
  }
}
