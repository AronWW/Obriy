import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  ParentChildOverviewDto,
  ParentChildProgressDto,
  ParentDashboardDto,
} from './dto/parent-dashboard.dto';
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
}
