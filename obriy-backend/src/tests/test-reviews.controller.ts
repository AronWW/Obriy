import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  ReviewTestAnswerDto,
  ListTestReviewsQueryDto,
  TeacherTestReviewListDto,
  TeacherTestAttemptReviewDto,
} from './dto/test-review.dto';
import { TestReviewsService } from './test-reviews.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Test reviews')
@ApiBearerAuth()
@Controller('lessons/:lessonId/test-attempts')
export class LessonTestReviewsController {
  constructor(private readonly reviewsService: TestReviewsService) {}

  @ApiOkResponse({ type: TeacherTestReviewListDto })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Query() query: ListTestReviewsQueryDto,
  ): Promise<TeacherTestReviewListDto> {
    return this.reviewsService.listLessonReviews(user, lessonId, query);
  }
}

@UseGuards(JwtAuthGuard)
@ApiTags('Test reviews')
@ApiBearerAuth()
@Controller('test-answers')
export class TestAnswerReviewsController {
  constructor(private readonly reviewsService: TestReviewsService) {}

  @ApiOkResponse({ type: TeacherTestAttemptReviewDto })
  @HttpCode(200)
  @Patch(':answerId/review')
  review(
    @CurrentUser() user: AuthUser,
    @Param('answerId') answerId: string,
    @Body() dto: ReviewTestAnswerDto,
  ): Promise<TeacherTestAttemptReviewDto> {
    return this.reviewsService.reviewAnswer(user, answerId, dto);
  }
}
