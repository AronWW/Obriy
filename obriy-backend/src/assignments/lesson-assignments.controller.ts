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
import { LessonAssignmentResponseDto } from './dto/lesson-assignment-response.dto';
import { LinkLessonAssignmentDto } from './dto/link-lesson-assignment.dto';
import { LessonAssignmentsService } from './lesson-assignments.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Lesson assignments')
@ApiBearerAuth()
@Controller('lessons/:lessonId/assignments')
export class LessonAssignmentsController {
  constructor(
    private readonly lessonAssignmentsService: LessonAssignmentsService,
  ) {}

  @ApiOkResponse({ type: LessonAssignmentResponseDto, isArray: true })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
  ): Promise<LessonAssignmentResponseDto[]> {
    return this.lessonAssignmentsService.list(user, lessonId);
  }

  @ApiCreatedResponse({ type: LessonAssignmentResponseDto })
  @Post()
  link(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: LinkLessonAssignmentDto,
  ): Promise<LessonAssignmentResponseDto> {
    return this.lessonAssignmentsService.link(user, lessonId, dto.assignmentId);
  }

  @ApiOkResponse({ type: LessonAssignmentResponseDto })
  @HttpCode(200)
  @Post(':assignmentId/update-version')
  updateVersion(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Param('assignmentId') assignmentId: string,
  ): Promise<LessonAssignmentResponseDto> {
    return this.lessonAssignmentsService.updateVersion(
      user,
      lessonId,
      assignmentId,
    );
  }

  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(':assignmentId')
  unlink(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Param('assignmentId') assignmentId: string,
  ): Promise<void> {
    return this.lessonAssignmentsService.unlink(user, lessonId, assignmentId);
  }
}
