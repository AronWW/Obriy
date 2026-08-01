import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrivateProfileDto } from './dto/profile.dto';
import { LinkedChildDto } from './dto/linked-child.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser): Promise<PrivateProfileDto> {
    return this.usersService.findMe(user.id);
  }

  @ApiOperation({
    summary: 'List student accounts linked to the signed-in parent',
  })
  @ApiOkResponse({ type: LinkedChildDto, isArray: true })
  @ApiForbiddenResponse({
    description: 'Only parent accounts may use this endpoint',
  })
  @Get('me/children')
  getMyLinkedChildren(
    @CurrentUser() user: AuthUser,
  ): Promise<LinkedChildDto[]> {
    return this.usersService.findMyLinkedChildren(user);
  }

  @Patch('me/profile')
  updateMyProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMyProfileDto,
  ): Promise<PrivateProfileDto> {
    return this.usersService.updateMyProfile(user.id, dto);
  }
}
