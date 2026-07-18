import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrivateProfileDto } from './dto/profile.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser): Promise<PrivateProfileDto> {
    return this.usersService.findMe(user.id);
  }

  @Patch('me/profile')
  updateMyProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMyProfileDto,
  ): Promise<PrivateProfileDto> {
    return this.usersService.updateMyProfile(user.id, dto);
  }
}
