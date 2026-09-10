import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { LeaderboardPageDto } from './dto/leaderboard.dto';
import { LeaderboardService } from './leaderboard.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Leaderboard')
@ApiBearerAuth()
@Controller()
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @ApiOkResponse({ type: LeaderboardPageDto })
  @Get('leaderboard/me')
  getMine(
    @CurrentUser() user: AuthUser,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardPageDto> {
    return this.leaderboard.getMine(user, query);
  }

  @ApiOkResponse({ type: LeaderboardPageDto })
  @Get('teacher/leaderboard/classes/:classId')
  getTeacherClass(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardPageDto> {
    return this.leaderboard.getTeacherClass(user, classId, query);
  }
}
