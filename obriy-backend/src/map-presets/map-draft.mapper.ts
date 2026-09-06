import { Prisma } from '@prisma/client';
import { MapDraftDto } from './dto/map-draft.dto';

export const mapDraftSelect = {
  id: true,
  sourcePresetId: true,
  name: true,
  contentLocale: true,
  periodLabel: true,
  attribution: true,
  storageKey: true,
  originalFileName: true,
  fileSizeBytes: true,
  featureCount: true,
  vertexCount: true,
  bounds: true,
  defaultViewport: true,
  editVersion: true,
  updatedAt: true,
} satisfies Prisma.MapDraftSelect;

export type MapDraftRecord = Prisma.MapDraftGetPayload<{
  select: typeof mapDraftSelect;
}>;

export function toMapDraftDto(draft: MapDraftRecord): MapDraftDto {
  return {
    ...draft,
    geojsonUrl: draft.storageKey ? `/map-drafts/${draft.id}/geojson` : null,
    bounds: readObject(draft.bounds),
    defaultViewport: readObject(draft.defaultViewport),
  } as MapDraftDto;
}

function readObject(value: unknown): Record<string, number> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, number>)
    : null;
}
