import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { AssignmentReviewsService } from './assignment-reviews.service';
import { ReviewAssignmentAttemptDto } from './dto/review-assignment-attempt.dto';
import { TeacherAssignmentReviewDto } from './dto/teacher-assignment-review-response.dto';

@UseGuards(JwtAuthGuard)
@ApiTags('Assignment reviews')
@ApiBearerAuth()
@Controller('lessons/:lessonId/assignment-attempts')
export class LessonAssignmentReviewsController {
  constructor(private readonly reviewsService: AssignmentReviewsService) {}

  @ApiOkResponse({ type: TeacherAssignmentReviewDto, isArray: true })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
  ): Promise<TeacherAssignmentReviewDto[]> {
    return this.reviewsService.listLessonReviews(user, lessonId);
  }
}

@UseGuards(JwtAuthGuard)
@ApiTags('Assignment reviews')
@ApiBearerAuth()
@Controller('assignment-attempts')
export class AssignmentAttemptReviewsController {
  constructor(private readonly reviewsService: AssignmentReviewsService) {}

  @ApiOkResponse({ type: TeacherAssignmentReviewDto })
  @HttpCode(200)
  @Patch(':attemptId/review')
  review(
    @CurrentUser() user: AuthUser,
    @Param('attemptId') attemptId: string,
    @Body() dto: ReviewAssignmentAttemptDto,
  ): Promise<TeacherAssignmentReviewDto> {
    return this.reviewsService.review(user, attemptId, dto);
  }
}
