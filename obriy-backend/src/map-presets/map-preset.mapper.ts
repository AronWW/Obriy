import { InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MapBoundsDto,
  MapPresetDto,
  MapViewportDto,
} from './dto/map-preset.dto';

export const mapPresetSelect = {
  id: true,
  key: true,
  name: true,
  contentLocale: true,
  sourceType: true,
  geojsonUrl: true,
  idProperty: true,
  year: true,
  attribution: true,
  bounds: true,
  defaultViewport: true,
} satisfies Prisma.MapPresetSelect;

export type MapPresetRecord = Prisma.MapPresetGetPayload<{
  select: typeof mapPresetSelect;
}>;

export function toMapPresetDto(preset: MapPresetRecord): MapPresetDto {
  if (!preset.geojsonUrl || !preset.idProperty) {
    throw invalidConfiguration(preset.key);
  }
  return new MapPresetDto({
    ...preset,
    geojsonUrl: preset.geojsonUrl,
    idProperty: preset.idProperty,
    bounds: readBounds(preset.bounds, preset.key),
    defaultViewport: readViewport(preset.defaultViewport, preset.key),
  });
}

function readBounds(value: unknown, key: string): MapBoundsDto {
  const object = record(value);
  const bounds = {
    west: object?.west,
    south: object?.south,
    east: object?.east,
    north: object?.north,
  };
  if (
    !number(bounds.west, -180, 180) ||
    !number(bounds.south, -90, 90) ||
    !number(bounds.east, -180, 180) ||
    !number(bounds.north, -90, 90) ||
    bounds.west >= bounds.east ||
    bounds.south >= bounds.north
  ) {
    throw invalidConfiguration(key);
  }
  return bounds as MapBoundsDto;
}

function readViewport(value: unknown, key: string): MapViewportDto {
  const object = record(value);
  const viewport = {
    longitude: object?.longitude,
    latitude: object?.latitude,
    zoom: object?.zoom,
  };
  if (
    !number(viewport.longitude, -180, 180) ||
    !number(viewport.latitude, -90, 90) ||
    !number(viewport.zoom, 0, 24)
  ) {
    throw invalidConfiguration(key);
  }
  return viewport as MapViewportDto;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function number(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function invalidConfiguration(key: string): InternalServerErrorException {
  return new InternalServerErrorException({
    code: 'MAP_PRESET_CONFIG_INVALID',
    message: `Map preset ${key} is configured incorrectly`,
  });
}
