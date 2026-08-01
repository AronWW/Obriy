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
  Query,
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
import { CreateLessonDto } from './dto/create-lesson.dto';
import {
  ClassLessonItemDto,
  LessonDetailDto,
  LessonSummaryDto,
} from './dto/lesson.dto';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto';
import { MoveClassLessonDto } from './dto/move-class-lesson.dto';
import { SetClassLessonDto } from './dto/set-class-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonsService } from './lessons.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Lessons')
@ApiBearerAuth()
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @ApiCreatedResponse({ type: LessonDetailDto })
  @Post()
  createLesson(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLessonDto,
  ): Promise<LessonDetailDto> {
    return this.lessonsService.createLesson(user, dto);
  }

  @ApiOkResponse({ type: LessonSummaryDto, isArray: true })
  @Get()
  listMyLessons(
    @CurrentUser() user: AuthUser,
    @Query() query: ListLessonsQueryDto,
  ): Promise<LessonSummaryDto[]> {
    return this.lessonsService.listMyLessons(user, query);
  }

  @ApiOkResponse({ type: LessonDetailDto })
  @Get(':lessonId')
  findMyLesson(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
  ): Promise<LessonDetailDto> {
    return this.lessonsService.findMyLesson(user, lessonId);
  }

  @ApiOkResponse({ type: LessonDetailDto })
  @Patch(':lessonId')
  updateMyLesson(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonDto,
  ): Promise<LessonDetailDto> {
    return this.lessonsService.updateMyLesson(user, lessonId, dto);
  }

  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(':lessonId')
  deleteMyLesson(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
  ): Promise<void> {
    return this.lessonsService.deleteMyLesson(user, lessonId);
  }

  @ApiOkResponse({ type: LessonDetailDto })
  @HttpCode(200)
  @Post(':lessonId/archive')
  archiveMyLesson(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
  ): Promise<LessonDetailDto> {
    return this.lessonsService.archiveMyLesson(user, lessonId);
  }

  @ApiOkResponse({ type: LessonDetailDto })
  @HttpCode(200)
  @Post(':lessonId/restore')
  restoreMyLesson(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
  ): Promise<LessonDetailDto> {
    return this.lessonsService.restoreMyLesson(user, lessonId);
  }
}

@UseGuards(JwtAuthGuard)
@ApiTags('Class lessons')
@ApiBearerAuth()
@Controller('classes/:classId/lessons')
export class ClassLessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @ApiOkResponse({ type: ClassLessonItemDto, isArray: true })
  @Get()
  listClassLessons(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
  ): Promise<ClassLessonItemDto[]> {
    return this.lessonsService.listClassLessons(user, classId);
  }

  @ApiOkResponse({ type: ClassLessonItemDto })
  @Put(':lessonId')
  setClassLesson(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: SetClassLessonDto,
  ): Promise<ClassLessonItemDto> {
    return this.lessonsService.setClassLesson(
      user,
      classId,
      lessonId,
      dto.published,
    );
  }

  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(':lessonId')
  unlinkClassLesson(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<void> {
    return this.lessonsService.unlinkClassLesson(user, classId, lessonId);
  }

  @ApiOkResponse({ type: ClassLessonItemDto, isArray: true })
  @HttpCode(200)
  @Post(':lessonId/move')
  moveClassLesson(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: MoveClassLessonDto,
  ): Promise<ClassLessonItemDto[]> {
    return this.lessonsService.moveClassLesson(
      user,
      classId,
      lessonId,
      dto.direction,
    );
  }
}
