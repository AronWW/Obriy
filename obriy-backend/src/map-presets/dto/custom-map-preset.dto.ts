import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale, MapPresetStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateCustomMapPresetDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @Length(1, 160)
  name: string;

  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  contentLocale: Locale;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  labelProperty: string;

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

export class UpdateCustomMapPresetDto {
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

export class InspectCustomMapDto {
  @ApiProperty({ type: [String] })
  labelProperties: string[];
  @ApiProperty()
  featureCount: number;
  @ApiProperty()
  vertexCount: number;
}

export class ReplaceCustomMapGeoJsonDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  labelProperty: string;
}

export class ListMyMapsQueryDto {
  @ApiPropertyOptional({ enum: MapPresetStatus })
  @IsOptional()
  @IsEnum(MapPresetStatus)
  status?: MapPresetStatus;
}

export interface UploadedCustomMap {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}
