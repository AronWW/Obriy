import {
  Locale,
  MapPresetSourceType,
  MapPresetStatus,
  Prisma,
} from '@prisma/client';

export const BUILT_IN_MAP_PRESETS = [
  {
    key: 'world-adm0',
    name: 'Країни світу',
    contentLocale: Locale.UK,
    sourceType: MapPresetSourceType.BUILT_IN,
    status: MapPresetStatus.ACTIVE,
    geojsonUrl: '/maps/world-adm0.geojson',
    idProperty: 'featureId',
    year: null,
    attribution:
      'geoBoundaries gbOpen · джерела й ліцензії наведені в атрибуції snapshot',
    bounds: {
      west: -180,
      south: -85,
      east: 180,
      north: 85,
    },
    defaultViewport: {
      longitude: 15,
      latitude: 20,
      zoom: 1.25,
    },
  },
  {
    key: 'ukraine-adm1',
    name: 'Області України',
    contentLocale: Locale.UK,
    sourceType: MapPresetSourceType.BUILT_IN,
    status: MapPresetStatus.ACTIVE,
    geojsonUrl: '/maps/ukraine-adm1.geojson',
    idProperty: 'featureId',
    year: 2017,
    attribution: 'geoBoundaries UKR ADM1 · ODbL 1.0 · OpenStreetMap/Wambacher',
    bounds: {
      west: 21.8,
      south: 44.2,
      east: 40.3,
      north: 52.5,
    },
    defaultViewport: {
      longitude: 31.2,
      latitude: 48.8,
      zoom: 4.6,
    },
  },
] as const satisfies ReadonlyArray<{
  key: string;
  name: string;
  contentLocale: Locale;
  sourceType: MapPresetSourceType;
  status: MapPresetStatus;
  geojsonUrl: string;
  idProperty: string;
  year: number | null;
  attribution: string;
  bounds: Prisma.InputJsonObject;
  defaultViewport: Prisma.InputJsonObject;
}>;

export const BUILT_IN_MAP_PRESET_KEYS = BUILT_IN_MAP_PRESETS.map(
  (preset) => preset.key,
);
