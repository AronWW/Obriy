import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  ParentChildOverviewDto,
  ParentChildProgressDto,
  ParentDashboardDto,
  ParentLessonProgressDto,
} from './dto/parent-dashboard.dto';
import {
  StudentLessonTestDto,
  StudentTestAttemptDto,
} from '../tests/dto/student-test.dto';
import { ParentDashboardService } from './parent-dashboard.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Parent dashboard')
@ApiBearerAuth()
@Controller('parent')
export class ParentDashboardController {
  constructor(private readonly dashboard: ParentDashboardService) {}

  @ApiOkResponse({ type: ParentDashboardDto })
  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthUser): Promise<ParentDashboardDto> {
    return this.dashboard.getDashboard(user);
  }

  @ApiOkResponse({ type: ParentChildOverviewDto })
  @Get('children/:childId/overview')
  getChildOverview(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
  ): Promise<ParentChildOverviewDto> {
    return this.dashboard.getChildOverview(user, childId);
  }

  @ApiOkResponse({ type: ParentChildProgressDto })
  @Get('children/:childId/progress')
  getChildProgress(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
  ): Promise<ParentChildProgressDto> {
    return this.dashboard.getChildProgress(user, childId);
  }

  @ApiOkResponse({ type: ParentLessonProgressDto })
  @Get('children/:childId/lessons/:lessonId')
  getChildLesson(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<ParentLessonProgressDto> {
    return this.dashboard.getChildLesson(user, childId, lessonId);
  }

  @ApiOkResponse({ type: StudentLessonTestDto })
  @Get('children/:childId/test-releases/:releaseId')
  getChildTestRelease(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
    @Param('releaseId') releaseId: string,
  ): Promise<StudentLessonTestDto> {
    return this.dashboard.getChildTestRelease(user, childId, releaseId);
  }

  @ApiOkResponse({ type: StudentTestAttemptDto })
  @Get('children/:childId/test-attempts/:attemptId')
  getChildTestAttempt(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
    @Param('attemptId') attemptId: string,
  ): Promise<StudentTestAttemptDto> {
    return this.dashboard.getChildTestAttempt(user, childId, attemptId);
  }
}
