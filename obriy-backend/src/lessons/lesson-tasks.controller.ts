import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
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
import { CreateLessonTaskDto } from './dto/create-lesson-task.dto';
import {
  LessonTaskDto,
  StudentTaskSubmissionDto,
  TeacherTaskSubmissionDto,
} from './dto/lesson-task.dto';
import { ReviewLessonTaskSubmissionDto } from './dto/review-lesson-task-submission.dto';
import { SubmitLessonTaskDto } from './dto/submit-lesson-task.dto';
import { UpdateLessonTaskDto } from './dto/update-lesson-task.dto';
import { LessonTasksService } from './lesson-tasks.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Lesson tasks')
@ApiBearerAuth()
@Controller('lessons/:lessonId')
export class LessonTasksController {
  constructor(private readonly lessonTasksService: LessonTasksService) {}

  @ApiOkResponse({ type: LessonTaskDto, isArray: true })
  @Get('tasks')
  listLessonTasks(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
  ): Promise<LessonTaskDto[]> {
    return this.lessonTasksService.listLessonTasks(user, lessonId);
  }

  @ApiCreatedResponse({ type: LessonTaskDto })
  @Post('tasks')
  createLessonTask(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: CreateLessonTaskDto,
  ): Promise<LessonTaskDto> {
    return this.lessonTasksService.createLessonTask(user, lessonId, dto);
  }

  @ApiOkResponse({ type: LessonTaskDto })
  @Patch('tasks/:taskId')
  updateLessonTask(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateLessonTaskDto,
  ): Promise<LessonTaskDto> {
    return this.lessonTasksService.updateLessonTask(
      user,
      lessonId,
      taskId,
      dto,
    );
  }

  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete('tasks/:taskId')
  deleteLessonTask(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Param('taskId') taskId: string,
  ): Promise<void> {
    return this.lessonTasksService.deleteLessonTask(user, lessonId, taskId);
  }

  @ApiOkResponse({ type: TeacherTaskSubmissionDto, isArray: true })
  @Get('task-submissions')
  listLessonTaskSubmissions(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
  ): Promise<TeacherTaskSubmissionDto[]> {
    return this.lessonTasksService.listLessonTaskSubmissions(user, lessonId);
  }

  @ApiOkResponse({ type: TeacherTaskSubmissionDto })
  @Patch('tasks/:taskId/submissions/:submissionId')
  reviewLessonTaskSubmission(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Param('taskId') taskId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: ReviewLessonTaskSubmissionDto,
  ): Promise<TeacherTaskSubmissionDto> {
    return this.lessonTasksService.reviewLessonTaskSubmission(
      user,
      lessonId,
      taskId,
      submissionId,
      dto,
    );
  }
}

@UseGuards(JwtAuthGuard)
@ApiTags('Student lesson tasks')
@ApiBearerAuth()
@Controller('classes/me/lessons/:lessonId/tasks')
export class StudentLessonTaskSubmissionsController {
  constructor(private readonly lessonTasksService: LessonTasksService) {}

  @ApiOkResponse({ type: StudentTaskSubmissionDto })
  @Put(':taskId/submission')
  submitLessonTask(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Param('taskId') taskId: string,
    @Body() dto: SubmitLessonTaskDto,
  ): Promise<StudentTaskSubmissionDto> {
    return this.lessonTasksService.submitLessonTask(
      user,
      lessonId,
      taskId,
      dto,
    );
  }
}
