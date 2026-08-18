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
import {
  SaveTestAnswerDto,
  StudentLessonTestDto,
  StudentTestAttemptDto,
} from './dto/student-test.dto';
import { StudentTestsService } from './student-tests.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Student tests')
@ApiBearerAuth()
@Controller('classes/me/lessons/:lessonId/tests')
export class StudentLessonTestsController {
  constructor(private readonly studentTestsService: StudentTestsService) {}

  @ApiOkResponse({ type: StudentLessonTestDto, isArray: true })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
  ): Promise<StudentLessonTestDto[]> {
    return this.studentTestsService.listLessonTests(user, lessonId);
  }
}

@UseGuards(JwtAuthGuard)
@ApiTags('Student test attempts')
@ApiBearerAuth()
@Controller('test-releases/:releaseId')
export class StudentTestReleasesController {
  constructor(private readonly studentTestsService: StudentTestsService) {}

  @ApiOkResponse({ type: StudentLessonTestDto })
  @Get()
  get(
    @CurrentUser() user: AuthUser,
    @Param('releaseId') releaseId: string,
  ): Promise<StudentLessonTestDto> {
    return this.studentTestsService.getRelease(user, releaseId);
  }

  @ApiOkResponse({ type: StudentTestAttemptDto })
  @HttpCode(200)
  @Post('attempts')
  startAttempt(
    @CurrentUser() user: AuthUser,
    @Param('releaseId') releaseId: string,
  ): Promise<StudentTestAttemptDto> {
    return this.studentTestsService.startAttempt(user, releaseId);
  }
}

@UseGuards(JwtAuthGuard)
@ApiTags('Student test attempts')
@ApiBearerAuth()
@Controller('test-attempts/:attemptId')
export class StudentTestAttemptsController {
  constructor(private readonly studentTestsService: StudentTestsService) {}

  @ApiOkResponse({ type: StudentTestAttemptDto })
  @Put('answers/:testItemId')
  saveAnswer(
    @CurrentUser() user: AuthUser,
    @Param('attemptId') attemptId: string,
    @Param('testItemId') testItemId: string,
    @Body() dto: SaveTestAnswerDto,
  ): Promise<StudentTestAttemptDto> {
    return this.studentTestsService.saveAnswer(
      user,
      attemptId,
      testItemId,
      dto,
    );
  }

  @ApiOkResponse({ type: StudentTestAttemptDto })
  @HttpCode(200)
  @Post('submit')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('attemptId') attemptId: string,
  ): Promise<StudentTestAttemptDto> {
    return this.studentTestsService.submitAttempt(user, attemptId);
  }
}
