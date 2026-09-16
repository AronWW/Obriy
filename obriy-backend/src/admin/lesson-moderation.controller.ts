import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { AdminService } from './admin.service';
import {
  ReportLessonDto,
  ResubmitLessonModerationDto,
} from './dto/admin-input.dto';
import {
  LessonReportReceiptDto,
  TeacherLessonModerationDto,
} from './dto/admin-output.dto';

@UseGuards(JwtAuthGuard)
@ApiTags('Lesson moderation')
@ApiBearerAuth()
@Controller()
export class LessonModerationController {
  constructor(private readonly admin: AdminService) {}

  @Post('student/lessons/:lessonId/report')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiCreatedResponse({ type: LessonReportReceiptDto })
  reportAsStudent(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: ReportLessonDto,
  ) {
    return this.admin.reportStudentLesson(user, lessonId, dto);
  }

  @Post('parent/children/:childId/lessons/:lessonId/report')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiCreatedResponse({ type: LessonReportReceiptDto })
  reportAsParent(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: ReportLessonDto,
  ) {
    return this.admin.reportParentLesson(user, childId, lessonId, dto);
  }

  @Post('lessons/:lessonId/moderation/resubmit')
  @HttpCode(200)
  @ApiOkResponse({ type: TeacherLessonModerationDto })
  resubmit(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: ResubmitLessonModerationDto,
  ) {
    return this.admin.resubmitLesson(user, lessonId, dto);
  }
}
