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
import { CreateTestDto } from './dto/create-test.dto';
import { ListTestsQueryDto } from './dto/list-tests-query.dto';
import { PublishTestDto } from './dto/publish-test.dto';
import {
  AddTestItemDto,
  RemoveTestItemDto,
  ReorderTestItemsDto,
  UpdateTestItemDto,
  UpdateTestItemRevisionDto,
} from './dto/test-items.dto';
import { TestEditorDto, TestListResponseDto } from './dto/test-response.dto';
import { UpdateTestDraftDto } from './dto/update-test-draft.dto';
import { TestsService } from './tests.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Tests')
@ApiBearerAuth()
@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @ApiCreatedResponse({ type: TestEditorDto })
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTestDto,
  ): Promise<TestEditorDto> {
    return this.testsService.createTest(user, dto);
  }

  @ApiOkResponse({ type: TestListResponseDto })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTestsQueryDto,
  ): Promise<TestListResponseDto> {
    return this.testsService.listTests(user, query);
  }

  @ApiOkResponse({ type: TestEditorDto })
  @Get(':testId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
  ): Promise<TestEditorDto> {
    return this.testsService.getTest(user, testId);
  }

  @ApiOkResponse({ type: TestEditorDto })
  @Patch(':testId/draft')
  updateDraft(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
    @Body() dto: UpdateTestDraftDto,
  ): Promise<TestEditorDto> {
    return this.testsService.updateDraft(user, testId, dto);
  }

  @ApiCreatedResponse({ type: TestEditorDto })
  @Post(':testId/draft/items')
  addItem(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
    @Body() dto: AddTestItemDto,
  ): Promise<TestEditorDto> {
    return this.testsService.addItem(user, testId, dto);
  }

  @ApiOkResponse({ type: TestEditorDto })
  @Patch(':testId/draft/items/:itemId')
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateTestItemDto,
  ): Promise<TestEditorDto> {
    return this.testsService.updateItem(user, testId, itemId, dto);
  }

  @ApiOkResponse({ type: TestEditorDto })
  @HttpCode(200)
  @Post(':testId/draft/items/:itemId/update-revision')
  updateItemRevision(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateTestItemRevisionDto,
  ): Promise<TestEditorDto> {
    return this.testsService.updateItemRevision(user, testId, itemId, dto);
  }

  @ApiOkResponse({ type: TestEditorDto })
  @Put(':testId/draft/items/order')
  reorderItems(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
    @Body() dto: ReorderTestItemsDto,
  ): Promise<TestEditorDto> {
    return this.testsService.reorderItems(user, testId, dto);
  }

  @ApiOkResponse({ type: TestEditorDto })
  @Delete(':testId/draft/items/:itemId')
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
    @Param('itemId') itemId: string,
    @Body() dto: RemoveTestItemDto,
  ): Promise<TestEditorDto> {
    return this.testsService.removeItem(user, testId, itemId, dto);
  }

  @ApiOkResponse({ type: TestEditorDto })
  @HttpCode(200)
  @Post(':testId/start-edit')
  startEdit(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
  ): Promise<TestEditorDto> {
    return this.testsService.startEdit(user, testId);
  }

  @ApiOkResponse({ type: TestEditorDto })
  @HttpCode(200)
  @Post(':testId/publish')
  publish(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
    @Body() dto: PublishTestDto,
  ): Promise<TestEditorDto> {
    return this.testsService.publish(user, testId, dto);
  }

  @ApiOkResponse({ type: TestEditorDto })
  @HttpCode(200)
  @Post(':testId/archive')
  archive(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
  ): Promise<TestEditorDto> {
    return this.testsService.archive(user, testId);
  }

  @ApiOkResponse({ type: TestEditorDto })
  @HttpCode(200)
  @Post(':testId/restore')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
  ): Promise<TestEditorDto> {
    return this.testsService.restore(user, testId);
  }

  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(':testId')
  delete(
    @CurrentUser() user: AuthUser,
    @Param('testId') testId: string,
  ): Promise<void> {
    return this.testsService.deleteTest(user, testId);
  }
}
