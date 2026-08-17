import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { SaveWrittenAssignmentDraftDto } from './dto/save-written-assignment-draft.dto';
import {
  StudentAssignmentAttemptDto,
  StudentLessonAssignmentDto,
} from './dto/student-assignment-response.dto';
import { StudentAssignmentsService } from './student-assignments.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Student assignments')
@ApiBearerAuth()
@Controller('classes/me/lessons/:lessonId/assignments')
export class StudentLessonAssignmentsController {
  constructor(
    private readonly studentAssignmentsService: StudentAssignmentsService,
  ) {}

  @ApiOkResponse({ type: StudentLessonAssignmentDto, isArray: true })
  @Get()
  listLessonAssignments(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
  ): Promise<StudentLessonAssignmentDto[]> {
    return this.studentAssignmentsService.listLessonAssignments(user, lessonId);
  }
}

@UseGuards(JwtAuthGuard)
@ApiTags('Student assignment attempts')
@ApiBearerAuth()
@Controller('assignment-releases/:releaseId')
export class StudentAssignmentAttemptsController {
  constructor(
    private readonly studentAssignmentsService: StudentAssignmentsService,
  ) {}

  @ApiOkResponse({ type: StudentAssignmentAttemptDto })
  @Put('draft')
  saveDraft(
    @CurrentUser() user: AuthUser,
    @Param('releaseId') releaseId: string,
    @Body() dto: SaveWrittenAssignmentDraftDto,
  ): Promise<StudentAssignmentAttemptDto> {
    return this.studentAssignmentsService.saveDraft(user, releaseId, dto);
  }

  @ApiOkResponse({ type: StudentAssignmentAttemptDto })
  @HttpCode(200)
  @Post('submit')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('releaseId') releaseId: string,
    @Body() dto: SaveWrittenAssignmentDraftDto,
  ): Promise<StudentAssignmentAttemptDto> {
    return this.studentAssignmentsService.submit(user, releaseId, dto);
  }
}
