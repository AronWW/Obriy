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
  Redirect,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  CreateMapDraftDto,
  ImportMapDraftDto,
  MapDraftDto,
  PublishMapDraftDto,
  PublishMapDraftResultDto,
  SaveMapDraftGeometryDto,
  UpdateMapDraftDto,
  type UploadedCustomMap,
} from './dto/map-draft.dto';
import { MapDraftsService } from './map-drafts.service';

const mapFileInterceptor = FileInterceptor('file', {
  limits: { fileSize: 20 * 1024 * 1024 },
});

@UseGuards(JwtAuthGuard)
@ApiTags('Map drafts')
@ApiBearerAuth()
@Controller('map-drafts')
export class MapDraftsController {
  constructor(private readonly drafts: MapDraftsService) {}

  @ApiOkResponse({ type: MapDraftDto, isArray: true })
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<MapDraftDto[]> {
    return this.drafts.list(user);
  }

  @ApiCreatedResponse({ type: MapDraftDto })
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMapDraftDto,
  ): Promise<MapDraftDto> {
    return this.drafts.create(user, dto);
  }

  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: MapDraftDto })
  @UseInterceptors(mapFileInterceptor)
  @Post('import')
  import(
    @CurrentUser() user: AuthUser,
    @Body() dto: ImportMapDraftDto,
    @UploadedFile() file?: UploadedCustomMap,
  ): Promise<MapDraftDto> {
    return this.drafts.import(user, dto, file);
  }

  @ApiCreatedResponse({ type: MapDraftDto })
  @Post('from-preset/:presetId')
  fromPreset(
    @CurrentUser() user: AuthUser,
    @Param('presetId') presetId: string,
  ): Promise<MapDraftDto> {
    return this.drafts.fromPreset(user, presetId);
  }

  @Get(':draftId/geojson')
  @Redirect(undefined, 302)
  async deliver(
    @CurrentUser() user: AuthUser,
    @Param('draftId') draftId: string,
  ) {
    return { url: await this.drafts.deliveryUrl(user, draftId) };
  }

  @ApiOkResponse({ type: MapDraftDto })
  @Get(':draftId')
  find(
    @CurrentUser() user: AuthUser,
    @Param('draftId') draftId: string,
  ): Promise<MapDraftDto> {
    return this.drafts.find(user, draftId);
  }

  @ApiOkResponse({ type: MapDraftDto })
  @Patch(':draftId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('draftId') draftId: string,
    @Body() dto: UpdateMapDraftDto,
  ): Promise<MapDraftDto> {
    return this.drafts.update(user, draftId, dto);
  }

  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: MapDraftDto })
  @UseInterceptors(mapFileInterceptor)
  @Put(':draftId/geojson')
  saveGeometry(
    @CurrentUser() user: AuthUser,
    @Param('draftId') draftId: string,
    @Body() dto: SaveMapDraftGeometryDto,
    @UploadedFile() file?: UploadedCustomMap,
  ): Promise<MapDraftDto> {
    return this.drafts.saveGeometry(
      user,
      draftId,
      dto.expectedEditVersion,
      file,
    );
  }

  @ApiOkResponse({ type: PublishMapDraftResultDto })
  @Post(':draftId/publish')
  publish(
    @CurrentUser() user: AuthUser,
    @Param('draftId') draftId: string,
    @Body() dto: PublishMapDraftDto,
  ): Promise<PublishMapDraftResultDto> {
    return this.drafts.publish(user, draftId, dto.expectedEditVersion);
  }

  @HttpCode(204)
  @Delete(':draftId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('draftId') draftId: string,
  ): Promise<void> {
    return this.drafts.delete(user, draftId);
  }
}
