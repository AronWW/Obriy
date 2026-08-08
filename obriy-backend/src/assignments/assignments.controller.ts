import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
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
import { AssignmentPreviewQueryDto } from './dto/assignment-preview-query.dto';
import {
  AssignmentEditorDto,
  AssignmentListResponseDto,
  AssignmentPreviewDto,
  AssignmentRevisionSummaryDto,
} from './dto/assignment-response.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { DuplicateAssignmentDto } from './dto/duplicate-assignment.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments-query.dto';
import { PublishAssignmentDto } from './dto/publish-assignment.dto';
import { UpdateAssignmentDraftDto } from './dto/update-assignment-draft.dto';
import { AssignmentsService } from './assignments.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Assignments')
@ApiBearerAuth()
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @ApiCreatedResponse({ type: AssignmentEditorDto })
  @Post()
  createAssignment(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAssignmentDto,
  ): Promise<AssignmentEditorDto> {
    return this.assignmentsService.createAssignment(user, dto);
  }

  @ApiOkResponse({ type: AssignmentListResponseDto })
  @Get()
  listAssignments(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAssignmentsQueryDto,
  ): Promise<AssignmentListResponseDto> {
    return this.assignmentsService.listAssignments(user, query);
  }

  @ApiOkResponse({ type: AssignmentPreviewDto })
  @Get(':assignmentId/preview')
  previewAssignment(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
    @Query() query: AssignmentPreviewQueryDto,
  ): Promise<AssignmentPreviewDto> {
    return this.assignmentsService.preview(user, assignmentId, query);
  }

  @ApiOkResponse({ type: AssignmentRevisionSummaryDto, isArray: true })
  @Get(':assignmentId/revisions')
  listRevisions(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
  ): Promise<AssignmentRevisionSummaryDto[]> {
    return this.assignmentsService.listRevisions(user, assignmentId);
  }

  @ApiOkResponse({ type: AssignmentEditorDto })
  @Get(':assignmentId')
  getAssignment(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
  ): Promise<AssignmentEditorDto> {
    return this.assignmentsService.getAssignment(user, assignmentId);
  }

  @ApiOkResponse({ type: AssignmentEditorDto })
  @Patch(':assignmentId/draft')
  updateDraft(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateAssignmentDraftDto,
  ): Promise<AssignmentEditorDto> {
    return this.assignmentsService.updateDraft(user, assignmentId, dto);
  }

  @ApiOkResponse({ type: AssignmentEditorDto })
  @HttpCode(200)
  @Post(':assignmentId/start-edit')
  startEdit(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
  ): Promise<AssignmentEditorDto> {
    return this.assignmentsService.startEdit(user, assignmentId);
  }

  @ApiOkResponse({ type: AssignmentEditorDto })
  @HttpCode(200)
  @Post(':assignmentId/publish')
  publish(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: PublishAssignmentDto,
  ): Promise<AssignmentEditorDto> {
    return this.assignmentsService.publish(user, assignmentId, dto);
  }

  @ApiCreatedResponse({ type: AssignmentEditorDto })
  @Post(':assignmentId/duplicate')
  duplicate(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: DuplicateAssignmentDto,
  ): Promise<AssignmentEditorDto> {
    return this.assignmentsService.duplicate(user, assignmentId, dto);
  }

  @ApiOkResponse({ type: AssignmentEditorDto })
  @HttpCode(200)
  @Post(':assignmentId/archive')
  archive(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
  ): Promise<AssignmentEditorDto> {
    return this.assignmentsService.archive(user, assignmentId);
  }

  @ApiOkResponse({ type: AssignmentEditorDto })
  @HttpCode(200)
  @Post(':assignmentId/restore')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
  ): Promise<AssignmentEditorDto> {
    return this.assignmentsService.restore(user, assignmentId);
  }

  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(':assignmentId/revisions/:revisionId')
  deleteRevision(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
    @Param('revisionId') revisionId: string,
  ): Promise<void> {
    return this.assignmentsService.deleteRevision(
      user,
      assignmentId,
      revisionId,
    );
  }

  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(':assignmentId')
  deleteAssignment(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
  ): Promise<void> {
    return this.assignmentsService.deleteAssignment(user, assignmentId);
  }
}
