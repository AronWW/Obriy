import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MapPresetDto } from './dto/map-preset.dto';
import { MapPresetsService } from './map-presets.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Map presets')
@ApiBearerAuth()
@Controller('map-presets')
export class MapPresetsController {
  constructor(private readonly mapPresetsService: MapPresetsService) {}

  @ApiOkResponse({ type: MapPresetDto, isArray: true })
  @Get()
  listActive(): Promise<MapPresetDto[]> {
    return this.mapPresetsService.listActive();
  }

  @ApiOkResponse({ type: MapPresetDto })
  @Get(':presetId')
  findActive(@Param('presetId') presetId: string): Promise<MapPresetDto> {
    return this.mapPresetsService.findActive(presetId);
  }
}
