import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale, MapPresetSourceType } from '@prisma/client';

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

  @ApiProperty()
  geojsonUrl: string;

  @ApiProperty()
  idProperty: string;

  @ApiPropertyOptional({ nullable: true })
  year: number | null;

  @ApiProperty()
  attribution: string;

  @ApiProperty({ type: MapBoundsDto })
  bounds: MapBoundsDto;

  @ApiProperty({ type: MapViewportDto })
  defaultViewport: MapViewportDto;

  constructor(data: MapPresetDto) {
    Object.assign(this, data);
  }
}
