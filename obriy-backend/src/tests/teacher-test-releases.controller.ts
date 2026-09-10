import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  BulkUpdateTestReleaseSettingsDto,
  TeacherTestReleaseDto,
  TestReleaseIdsDto,
  UpdateTestReleaseSettingsDto,
} from './dto/test-release.dto';
import { TeacherTestReleasesService } from './teacher-test-releases.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Teacher test releases')
@ApiBearerAuth()
@Controller('lessons/:lessonId/tests/:testId/releases')
export class TeacherLessonTestReleasesController {
  constructor(
    private readonly teacherTestReleasesService: TeacherTestReleasesService,
  ) {}

  @ApiOkResponse({ type: TeacherTestReleaseDto, isArray: true })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Param('testId') testId: string,
  ): Promise<TeacherTestReleaseDto[]> {
    return this.teacherTestReleasesService.list(user, lessonId, testId);
  }

  @ApiOkResponse({ type: TeacherTestReleaseDto, isArray: true })
  @Patch('bulk')
  updateMany(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Param('testId') testId: string,
    @Body() dto: BulkUpdateTestReleaseSettingsDto,
  ): Promise<TeacherTestReleaseDto[]> {
    return this.teacherTestReleasesService.updateMany(
      user,
      lessonId,
      testId,
      dto.releaseIds,
      dto.settings,
    );
  }

  @ApiOkResponse({ type: TeacherTestReleaseDto, isArray: true })
  @HttpCode(200)
  @Post('publish')
  publishMany(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Param('testId') testId: string,
    @Body() dto: TestReleaseIdsDto,
  ): Promise<TeacherTestReleaseDto[]> {
    return this.teacherTestReleasesService.publishMany(
      user,
      lessonId,
      testId,
      dto.releaseIds,
    );
  }
}

@UseGuards(JwtAuthGuard)
@ApiTags('Teacher test releases')
@ApiBearerAuth()
@Controller('test-releases/:releaseId')
export class TeacherTestReleasesController {
  constructor(
    private readonly teacherTestReleasesService: TeacherTestReleasesService,
  ) {}

  @ApiOkResponse({ type: TeacherTestReleaseDto })
  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @Param('releaseId') releaseId: string,
    @Body() dto: UpdateTestReleaseSettingsDto,
  ): Promise<TeacherTestReleaseDto> {
    return this.teacherTestReleasesService.update(user, releaseId, dto);
  }

  @ApiOkResponse({ type: TeacherTestReleaseDto })
  @HttpCode(200)
  @Post('publish')
  publish(
    @CurrentUser() user: AuthUser,
    @Param('releaseId') releaseId: string,
  ): Promise<TeacherTestReleaseDto> {
    return this.teacherTestReleasesService.publish(user, releaseId);
  }

  @ApiOkResponse({ type: TeacherTestReleaseDto })
  @HttpCode(200)
  @Post('close')
  close(
    @CurrentUser() user: AuthUser,
    @Param('releaseId') releaseId: string,
  ): Promise<TeacherTestReleaseDto> {
    return this.teacherTestReleasesService.close(user, releaseId);
  }

  @ApiOkResponse({ type: TeacherTestReleaseDto })
  @HttpCode(200)
  @Post('reopen')
  reopen(
    @CurrentUser() user: AuthUser,
    @Param('releaseId') releaseId: string,
  ): Promise<TeacherTestReleaseDto> {
    return this.teacherTestReleasesService.reopen(user, releaseId);
  }
}
