import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  AcknowledgeGamificationRewardsDto,
  GamificationProfileDto,
  StudentAchievementsDto,
  UnseenGamificationRewardsDto,
  UpdateBadgeShowcaseDto,
} from './dto/gamification.dto';
import { GamificationService } from './gamification.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Gamification')
@ApiBearerAuth()
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @ApiOkResponse({ type: GamificationProfileDto })
  @Get('me')
  getMe(@CurrentUser() user: AuthUser): Promise<GamificationProfileDto> {
    return this.gamification.getMyProfile(user);
  }

  @ApiOkResponse({ type: StudentAchievementsDto })
  @Get('me/achievements')
  getMyAchievements(
    @CurrentUser() user: AuthUser,
  ): Promise<StudentAchievementsDto> {
    return this.gamification.getMyAchievements(user);
  }

  @ApiOkResponse({ type: GamificationProfileDto })
  @Patch('me/showcase')
  updateShowcase(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBadgeShowcaseDto,
  ): Promise<GamificationProfileDto> {
    return this.gamification.updateShowcase(user, dto);
  }

  @ApiOkResponse({ type: UnseenGamificationRewardsDto })
  @Get('me/rewards/unseen')
  getUnseenRewards(
    @CurrentUser() user: AuthUser,
  ): Promise<UnseenGamificationRewardsDto> {
    return this.gamification.getUnseenRewards(user);
  }

  @Post('me/rewards/acknowledge')
  @HttpCode(HttpStatus.NO_CONTENT)
  acknowledgeRewards(
    @CurrentUser() user: AuthUser,
    @Body() dto: AcknowledgeGamificationRewardsDto,
  ): Promise<void> {
    return this.gamification.acknowledgeRewards(user, dto);
  }
}
