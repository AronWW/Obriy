import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { LinkedChildDto } from '../users/dto/linked-child.dto';
import {
  ActiveParentInvitationDto,
  LinkedGuardianDto,
  ParentInvitationDto,
  ParentInvitationPreviewDto,
} from './dto/parent-link.dto';
import { ParentInvitationTokenDto } from './dto/parent-invitation-token.dto';
import { ParentLinksService } from './parent-links.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Parent links')
@ApiBearerAuth()
@Controller('parent-links')
export class ParentLinksController {
  constructor(private readonly parentLinksService: ParentLinksService) {}

  @ApiOkResponse({ type: LinkedGuardianDto, isArray: true })
  @Get('me/guardians')
  listMyGuardians(@CurrentUser() user: AuthUser): Promise<LinkedGuardianDto[]> {
    return this.parentLinksService.listMyGuardians(user);
  }

  @ApiOkResponse({ type: ActiveParentInvitationDto, nullable: true })
  @Get('invitation')
  findActiveInvitation(
    @CurrentUser() user: AuthUser,
  ): Promise<ActiveParentInvitationDto | null> {
    return this.parentLinksService.findActiveInvitation(user);
  }

  @ApiCreatedResponse({ type: ParentInvitationDto })
  @Post('invitation')
  createInvitation(
    @CurrentUser() user: AuthUser,
  ): Promise<ParentInvitationDto> {
    return this.parentLinksService.createInvitation(user);
  }

  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete('invitation')
  revokeActiveInvitation(@CurrentUser() user: AuthUser): Promise<void> {
    return this.parentLinksService.revokeActiveInvitation(user);
  }

  @ApiOkResponse({ type: ParentInvitationPreviewDto })
  @HttpCode(200)
  @Post('invitation/preview')
  previewInvitation(
    @CurrentUser() user: AuthUser,
    @Body() dto: ParentInvitationTokenDto,
  ): Promise<ParentInvitationPreviewDto> {
    return this.parentLinksService.previewInvitation(user, dto.token);
  }

  @ApiCreatedResponse({ type: LinkedChildDto })
  @Post('invitation/accept')
  acceptInvitation(
    @CurrentUser() user: AuthUser,
    @Body() dto: ParentInvitationTokenDto,
  ): Promise<LinkedChildDto> {
    return this.parentLinksService.acceptInvitation(user, dto.token);
  }

  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete('guardians/:parentId')
  unlinkGuardian(
    @CurrentUser() user: AuthUser,
    @Param('parentId') parentId: string,
  ): Promise<void> {
    return this.parentLinksService.unlinkGuardian(user, parentId);
  }

  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete('children/:childId')
  unlinkChild(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
  ): Promise<void> {
    return this.parentLinksService.unlinkChild(user, childId);
  }
}
