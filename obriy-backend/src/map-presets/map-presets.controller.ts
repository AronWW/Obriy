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
  CreateCustomMapPresetDto,
  InspectCustomMapDto,
  ListMyMapsQueryDto,
  ReplaceCustomMapGeoJsonDto,
  UpdateCustomMapPresetDto,
  type UploadedCustomMap,
} from './dto/custom-map-preset.dto';
import { MapPresetDto } from './dto/map-preset.dto';
import { MapPresetsService } from './map-presets.service';

const mapFileInterceptor = FileInterceptor('file', {
  limits: { fileSize: 20 * 1024 * 1024 },
});

@UseGuards(JwtAuthGuard)
@ApiTags('Map presets')
@ApiBearerAuth()
@Controller('map-presets')
export class MapPresetsController {
  constructor(private readonly maps: MapPresetsService) {}

  @ApiOkResponse({ type: MapPresetDto, isArray: true })
  @Get()
  listActive(@CurrentUser() user: AuthUser): Promise<MapPresetDto[]> {
    return this.maps.listActive(user);
  }

  @ApiOkResponse({ type: MapPresetDto, isArray: true })
  @Get('mine')
  listMine(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMyMapsQueryDto,
  ): Promise<MapPresetDto[]> {
    return this.maps.listMine(user, query.status);
  }

  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: InspectCustomMapDto })
  @HttpCode(200)
  @UseInterceptors(mapFileInterceptor)
  @Post('custom/inspect')
  inspect(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: UploadedCustomMap,
  ): InspectCustomMapDto {
    return this.maps.inspect(user, file);
  }

  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: MapPresetDto })
  @UseInterceptors(mapFileInterceptor)
  @Post('custom')
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCustomMapPresetDto,
    @UploadedFile() file?: UploadedCustomMap,
  ): Promise<MapPresetDto> {
    return this.maps.create(user, dto, file);
  }

  @Get(':presetId/geojson')
  @Redirect(undefined, 302)
  async deliver(
    @CurrentUser() user: AuthUser,
    @Param('presetId') presetId: string,
    @Query('attemptId') attemptId?: string,
  ) {
    return { url: await this.maps.deliveryUrl(user, presetId, attemptId) };
  }

  @ApiOkResponse({ type: MapPresetDto })
  @Get(':presetId')
  findActive(
    @CurrentUser() user: AuthUser,
    @Param('presetId') presetId: string,
  ): Promise<MapPresetDto> {
    return this.maps.findActive(user, presetId);
  }

  @ApiOkResponse({ type: MapPresetDto })
  @Patch(':presetId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('presetId') presetId: string,
    @Body() dto: UpdateCustomMapPresetDto,
  ): Promise<MapPresetDto> {
    return this.maps.update(user, presetId, dto);
  }

  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: MapPresetDto })
  @UseInterceptors(mapFileInterceptor)
  @Put(':presetId/geojson')
  replace(
    @CurrentUser() user: AuthUser,
    @Param('presetId') presetId: string,
    @Body() dto: ReplaceCustomMapGeoJsonDto,
    @UploadedFile() file?: UploadedCustomMap,
  ): Promise<MapPresetDto> {
    return this.maps.replaceGeoJson(user, presetId, dto, file);
  }

  @Post(':presetId/archive')
  archive(
    @CurrentUser() user: AuthUser,
    @Param('presetId') presetId: string,
  ): Promise<MapPresetDto> {
    return this.maps.archive(user, presetId);
  }

  @Post(':presetId/restore')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('presetId') presetId: string,
  ): Promise<MapPresetDto> {
    return this.maps.restore(user, presetId);
  }

  @HttpCode(204)
  @Delete(':presetId')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('presetId') presetId: string,
  ): Promise<void> {
    await this.maps.delete(user, presetId);
  }
}
