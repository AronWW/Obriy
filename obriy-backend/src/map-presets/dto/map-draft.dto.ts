import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { MapBoundsDto, MapPresetDto, MapViewportDto } from './map-preset.dto';

export class CreateMapDraftDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @Length(1, 160)
  name: string;

  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  contentLocale: Locale;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  periodLabel?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  attribution?: string;
}

export class ImportMapDraftDto extends CreateMapDraftDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  labelProperty: string;
}

export class UpdateMapDraftDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedEditVersion: number;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsEnum(Locale)
  contentLocale?: Locale;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  periodLabel?: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  attribution?: string;
}

export class SaveMapDraftGeometryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedEditVersion: number;
}

export class PublishMapDraftDto extends SaveMapDraftGeometryDto {}

export class MapDraftDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  sourcePresetId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: Locale })
  contentLocale: Locale;

  @ApiPropertyOptional({ nullable: true })
  periodLabel: string | null;

  @ApiProperty()
  attribution: string;

  @ApiPropertyOptional({ nullable: true })
  geojsonUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  originalFileName: string | null;

  @ApiPropertyOptional({ nullable: true })
  fileSizeBytes: number | null;

  @ApiProperty()
  featureCount: number;

  @ApiProperty()
  vertexCount: number;

  @ApiPropertyOptional({ type: MapBoundsDto, nullable: true })
  bounds: MapBoundsDto | null;

  @ApiPropertyOptional({ type: MapViewportDto, nullable: true })
  defaultViewport: MapViewportDto | null;

  @ApiProperty()
  editVersion: number;

  @ApiProperty()
  updatedAt: Date;
}

export class PublishMapDraftResultDto {
  @ApiProperty({ type: MapPresetDto })
  preset: MapPresetDto;
}

export type { UploadedCustomMap } from './custom-map-preset.dto';
