import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import {
  AdminAuditQueryDto,
  AdminModerationActionDto,
  AdminModerationQueryDto,
  AdminPageQueryDto,
  AdminReasonDto,
  AdminUsersQueryDto,
  AdminAppealsQueryDto,
  AdminAppealDecisionDto,
} from './dto/admin-input.dto';
import {
  AdminAuditLogPageDto,
  AdminClassDetailDto,
  AdminClassPageDto,
  AdminDashboardDto,
  AdminUserDto,
  AdminUserPageDto,
  LessonModerationCaseDto,
  LessonModerationCasePageDto,
  AdminSuspensionAppealDto,
  AdminSuspensionAppealPageDto,
} from './dto/admin-output.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @ApiOkResponse({ type: AdminDashboardDto })
  dashboard(@CurrentUser() user: AuthUser) {
    return this.admin.dashboard(user);
  }

  @Get('users')
  @ApiOkResponse({ type: AdminUserPageDto })
  users(@CurrentUser() user: AuthUser, @Query() query: AdminUsersQueryDto) {
    return this.admin.listUsers(user, query);
  }

  @Get('users/:userId')
  @ApiOkResponse({ type: AdminUserDto })
  user(@CurrentUser() actor: AuthUser, @Param('userId') userId: string) {
    return this.admin.getUser(actor, userId);
  }

  @Post('users/:userId/suspend')
  @HttpCode(200)
  @ApiOkResponse({ type: AdminUserDto })
  suspend(
    @CurrentUser() actor: AuthUser,
    @Param('userId') userId: string,
    @Body() dto: AdminReasonDto,
  ) {
    return this.admin.suspendUser(actor, userId, dto);
  }

  @Post('users/:userId/restore')
  @HttpCode(200)
  @ApiOkResponse({ type: AdminUserDto })
  restore(
    @CurrentUser() actor: AuthUser,
    @Param('userId') userId: string,
    @Body() dto: AdminReasonDto,
  ) {
    return this.admin.restoreUser(actor, userId, dto);
  }

  @Get('suspension-appeals')
  @ApiOkResponse({ type: AdminSuspensionAppealPageDto })
  appeals(
    @CurrentUser() actor: AuthUser,
    @Query() query: AdminAppealsQueryDto,
  ) {
    return this.admin.listSuspensionAppeals(actor, query);
  }

  @Get('suspension-appeals/:appealId')
  @ApiOkResponse({ type: AdminSuspensionAppealDto })
  appeal(@CurrentUser() actor: AuthUser, @Param('appealId') appealId: string) {
    return this.admin.getSuspensionAppeal(actor, appealId);
  }

  @Post('suspension-appeals/:appealId/approve')
  @HttpCode(200)
  @ApiOkResponse({ type: AdminSuspensionAppealDto })
  approveAppeal(
    @CurrentUser() actor: AuthUser,
    @Param('appealId') appealId: string,
    @Body() dto: AdminAppealDecisionDto,
  ) {
    return this.admin.resolveSuspensionAppeal(actor, appealId, dto, true);
  }

  @Post('suspension-appeals/:appealId/reject')
  @HttpCode(200)
  @ApiOkResponse({ type: AdminSuspensionAppealDto })
  rejectAppeal(
    @CurrentUser() actor: AuthUser,
    @Param('appealId') appealId: string,
    @Body() dto: AdminAppealDecisionDto,
  ) {
    return this.admin.resolveSuspensionAppeal(actor, appealId, dto, false);
  }

  @Get('classes')
  @ApiOkResponse({ type: AdminClassPageDto })
  classes(@CurrentUser() user: AuthUser, @Query() query: AdminPageQueryDto) {
    return this.admin.listClasses(user, query);
  }

  @Get('classes/:classId')
  @ApiOkResponse({ type: AdminClassDetailDto })
  classroom(@CurrentUser() user: AuthUser, @Param('classId') classId: string) {
    return this.admin.getClass(user, classId);
  }

  @Get('moderation/lessons')
  @ApiOkResponse({ type: LessonModerationCasePageDto })
  moderation(
    @CurrentUser() user: AuthUser,
    @Query() query: AdminModerationQueryDto,
  ) {
    return this.admin.listModeration(user, query);
  }

  @Get('moderation/lessons/:caseId')
  @ApiOkResponse({ type: LessonModerationCaseDto })
  moderationCase(
    @CurrentUser() user: AuthUser,
    @Param('caseId') caseId: string,
  ) {
    return this.admin.getModerationCase(user, caseId);
  }

  @Post('moderation/lessons/:caseId/hide')
  @HttpCode(200)
  hide(
    @CurrentUser() user: AuthUser,
    @Param('caseId') caseId: string,
    @Body() dto: AdminModerationActionDto,
  ) {
    return this.admin.hideLesson(user, caseId, dto);
  }

  @Post('moderation/lessons/:caseId/dismiss')
  @HttpCode(200)
  dismiss(
    @CurrentUser() user: AuthUser,
    @Param('caseId') caseId: string,
    @Body() dto: AdminModerationActionDto,
  ) {
    return this.admin.dismissReport(user, caseId, dto);
  }

  @Post('moderation/lessons/:caseId/request-changes')
  @HttpCode(200)
  requestChanges(
    @CurrentUser() user: AuthUser,
    @Param('caseId') caseId: string,
    @Body() dto: AdminModerationActionDto,
  ) {
    return this.admin.requestLessonChanges(user, caseId, dto);
  }

  @Post('moderation/lessons/:caseId/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('caseId') caseId: string,
    @Body() dto: AdminModerationActionDto,
  ) {
    return this.admin.approveLesson(user, caseId, dto);
  }

  @Post('moderation/lessons/:caseId/remove')
  @HttpCode(200)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('caseId') caseId: string,
    @Body() dto: AdminModerationActionDto,
  ) {
    return this.admin.removeLesson(user, caseId, dto);
  }

  @Get('audit-logs')
  @ApiOkResponse({ type: AdminAuditLogPageDto })
  audit(@CurrentUser() user: AuthUser, @Query() query: AdminAuditQueryDto) {
    return this.admin.listAuditLogs(user, query);
  }
}
