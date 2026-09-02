import { Injectable, NotFoundException } from '@nestjs/common';
import { MapPresetStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MapPresetDto } from './dto/map-preset.dto';
import { mapPresetSelect, toMapPresetDto } from './map-preset.mapper';

@Injectable()
export class MapPresetsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<MapPresetDto[]> {
    const presets = await this.prisma.mapPreset.findMany({
      where: { status: MapPresetStatus.ACTIVE },
      orderBy: [{ sourceType: 'asc' }, { name: 'asc' }],
      select: mapPresetSelect,
    });
    return presets.map(toMapPresetDto);
  }

  async findActive(presetId: string): Promise<MapPresetDto> {
    const preset = await this.prisma.mapPreset.findFirst({
      where: { id: presetId, status: MapPresetStatus.ACTIVE },
      select: mapPresetSelect,
    });
    if (!preset) {
      throw new NotFoundException({
        code: 'MAP_PRESET_NOT_FOUND',
        message: 'Map preset not found',
      });
    }
    return toMapPresetDto(preset);
  }
}
