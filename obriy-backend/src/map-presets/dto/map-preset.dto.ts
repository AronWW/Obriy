import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Locale,
  MapPresetBaseMapMode,
  MapPresetSourceType,
  MapPresetStatus,
} from '@prisma/client';

export class MapBoundsDto {
  @ApiProperty({ minimum: -180, maximum: 180 })
  west: number;

  @ApiProperty({ minimum: -90, maximum: 90 })
  south: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  east: number;

  @ApiProperty({ minimum: -90, maximum: 90 })
  north: number;
}

export class MapViewportDto {
  @ApiProperty({ minimum: -180, maximum: 180 })
  longitude: number;

  @ApiProperty({ minimum: -90, maximum: 90 })
  latitude: number;

  @ApiProperty({ minimum: 0, maximum: 24 })
  zoom: number;
}

export class MapPresetDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiProperty({ enum: MapPresetSourceType })
  sourceType: MapPresetSourceType;

  @ApiProperty({ enum: MapPresetBaseMapMode })
  baseMapMode: MapPresetBaseMapMode;

  @ApiProperty({ enum: MapPresetStatus })
  status: MapPresetStatus;

  @ApiProperty()
  geojsonUrl: string;

  @ApiProperty()
  idProperty: string;

  @ApiPropertyOptional({ nullable: true })
  year: number | null;

  @ApiPropertyOptional({ nullable: true })
  periodLabel: string | null;

  @ApiProperty()
  attribution: string;

  @ApiProperty({ type: MapBoundsDto })
  bounds: MapBoundsDto;

  @ApiProperty({ type: MapViewportDto })
  defaultViewport: MapViewportDto;

  @ApiPropertyOptional({ nullable: true })
  originalFileName: string | null;

  @ApiPropertyOptional({ nullable: true })
  fileSizeBytes: number | null;

  @ApiPropertyOptional({ nullable: true })
  featureCount: number | null;

  @ApiPropertyOptional({ nullable: true })
  vertexCount: number | null;

  @ApiProperty()
  geometryLocked: boolean;

  constructor(data: MapPresetDto) {
    Object.assign(this, data);
  }
}
