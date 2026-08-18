import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
import {
  LessonTestDto,
  LinkLessonTestDto,
  ReorderLessonTestsDto,
} from './dto/lesson-test.dto';
import { LessonTestsService } from './lesson-tests.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Lesson tests')
@ApiBearerAuth()
@Controller('lessons/:lessonId/tests')
export class LessonTestsController {
  constructor(private readonly lessonTestsService: LessonTestsService) {}

  @ApiOkResponse({ type: LessonTestDto, isArray: true })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
  ): Promise<LessonTestDto[]> {
    return this.lessonTestsService.list(user, lessonId);
  }

  @ApiCreatedResponse({ type: LessonTestDto })
  @Post()
  link(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: LinkLessonTestDto,
  ): Promise<LessonTestDto> {
    return this.lessonTestsService.link(user, lessonId, dto.testId);
  }

  @ApiOkResponse({ type: LessonTestDto, isArray: true })
  @Put('order')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: ReorderLessonTestsDto,
  ): Promise<LessonTestDto[]> {
    return this.lessonTestsService.reorder(user, lessonId, dto.testIds);
  }

  @ApiOkResponse({ type: LessonTestDto })
  @HttpCode(200)
  @Post(':testId/update-version')
  updateVersion(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Param('testId') testId: string,
  ): Promise<LessonTestDto> {
    return this.lessonTestsService.updateVersion(user, lessonId, testId);
  }

  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(':testId')
  unlink(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Param('testId') testId: string,
  ): Promise<void> {
    return this.lessonTestsService.unlink(user, lessonId, testId);
  }
}
