import { BadRequestException, Injectable } from '@nestjs/common';
import { applyCommands } from 'mapshaper';

const MAX_FEATURES = 5_000;
const TARGET_BYTES = 5 * 1024 * 1024;
const TARGET_VERTICES = 250_000;
const REGION_ID_PROPERTY = 'regionId';

type Position = [number, number, ...number[]];
type PolygonCoordinates = Position[][];
type MultiPolygonCoordinates = Position[][][];

interface PolygonGeometry {
  type: 'Polygon';
  coordinates: PolygonCoordinates;
}

interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: MultiPolygonCoordinates;
}

type SupportedGeometry = PolygonGeometry | MultiPolygonGeometry;

interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown> | null;
  geometry: SupportedGeometry;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface ProcessedCustomGeoJson {
  buffer: Buffer<ArrayBufferLike>;
  bounds: { west: number; south: number; east: number; north: number };
  defaultViewport: { longitude: number; latitude: number; zoom: number };
  featureCount: number;
  vertexCount: number;
  originalVertexCount: number;
  idProperty: typeof REGION_ID_PROPERTY;
}

@Injectable()
export class CustomGeoJsonProcessor {
  async process(
    buffer: Buffer,
    labelProperty: string,
  ): Promise<ProcessedCustomGeoJson> {
    const parsed = this.parse(buffer);
    const originalVertexCount = this.validateAndCount(parsed, false);
    const normalized = this.normalize(parsed, labelProperty.trim());
    this.validateAndCount(normalized);
    let output: Buffer<ArrayBufferLike> = Buffer.from(
      JSON.stringify(normalized),
    );
    let vertexCount = originalVertexCount;

    if (output.byteLength > TARGET_BYTES || vertexCount > TARGET_VERTICES) {
      ({ output, vertexCount } = await this.simplify(normalized, vertexCount));
    }

    const finalCollection = this.parse(output);
    vertexCount = this.validateAndCount(finalCollection);
    if (output.byteLength > TARGET_BYTES || vertexCount > TARGET_VERTICES) {
      throw this.invalid(
        'GEOJSON_TOO_COMPLEX',
        'Карту не вдалося безпечно оптимізувати для браузера.',
      );
    }

    const bounds = this.calculateBounds(finalCollection);
    return {
      buffer: output,
      bounds,
      defaultViewport: this.viewport(bounds),
      featureCount: finalCollection.features.length,
      vertexCount,
      originalVertexCount,
      idProperty: REGION_ID_PROPERTY,
    };
  }

  inspect(buffer: Buffer): {
    labelProperties: string[];
    featureCount: number;
    vertexCount: number;
  } {
    const collection = this.parse(buffer);
    const vertexCount = this.validateAndCount(collection, false);
    const candidates = collection.features.length
      ? Object.keys(collection.features[0]?.properties ?? {}).filter((key) =>
          collection.features.every((feature) => {
            const value = feature.properties?.[key];
            return (
              (typeof value === 'string' || typeof value === 'number') &&
              String(value).trim() !== ''
            );
          }),
        )
      : [];
    return {
      labelProperties: candidates,
      featureCount: collection.features.length,
      vertexCount,
    };
  }

  private parse(buffer: Buffer): FeatureCollection {
    let value: unknown;
    try {
      value = JSON.parse(buffer.toString('utf8'));
    } catch {
      throw this.invalid('INVALID_GEOJSON', 'Файл не містить коректний JSON.');
    }
    if (
      !this.isRecord(value) ||
      value.type !== 'FeatureCollection' ||
      !Array.isArray(value.features)
    ) {
      throw this.invalid(
        'INVALID_GEOJSON',
        'Потрібен GeoJSON FeatureCollection.',
      );
    }
    if (value.features.length < 1 || value.features.length > MAX_FEATURES) {
      throw this.invalid(
        'INVALID_FEATURE_COUNT',
        `Карта повинна містити від 1 до ${MAX_FEATURES} регіонів.`,
      );
    }
    return value as unknown as FeatureCollection;
  }

  private normalize(
    collection: FeatureCollection,
    labelProperty: string,
  ): FeatureCollection {
    if (!labelProperty) {
      throw this.invalid(
        'LABEL_PROPERTY_REQUIRED',
        'Оберіть поле з назвами регіонів.',
      );
    }
    const sourceIds = collection.features.map((feature) => {
      const canonicalId = feature.properties?.[REGION_ID_PROPERTY];
      return typeof canonicalId === 'string' && canonicalId.trim()
        ? canonicalId.trim()
        : feature.id;
    });
    const reuseIds = sourceIds.every(
      (id, index) =>
        (typeof id === 'string' || typeof id === 'number') &&
        String(id).trim() !== '' &&
        sourceIds.findIndex((candidate) => String(candidate) === String(id)) ===
          index,
    );

    return {
      type: 'FeatureCollection',
      features: collection.features.map((feature, index) => {
        const label = feature.properties?.[labelProperty];
        if (
          (typeof label !== 'string' && typeof label !== 'number') ||
          String(label).trim() === ''
        ) {
          throw this.invalid(
            'INVALID_LABEL_PROPERTY',
            `Поле «${labelProperty}» повинно містити назву для кожного регіону.`,
          );
        }
        return {
          type: 'Feature',
          properties: {
            [REGION_ID_PROPERTY]: reuseIds
              ? String(sourceIds[index])
              : `region-${index + 1}`,
            name: String(label).trim(),
          },
          geometry: feature.geometry,
        };
      }),
    };
  }

  private validateAndCount(
    collection: FeatureCollection,
    requireCanonical = true,
  ): number {
    const ids = new Set<string>();
    let vertices = 0;
    for (const [index, feature] of collection.features.entries()) {
      if (
        !this.isRecord(feature) ||
        feature.type !== 'Feature' ||
        !this.isRecord(feature.geometry)
      ) {
        throw this.invalid(
          'INVALID_FEATURE',
          `Регіон ${index + 1} має некоректну структуру.`,
        );
      }
      if (
        feature.geometry.type !== 'Polygon' &&
        feature.geometry.type !== 'MultiPolygon'
      ) {
        throw this.invalid(
          'UNSUPPORTED_GEOMETRY',
          'Дозволені лише Polygon і MultiPolygon.',
        );
      }
      const polygons =
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
      if (!Array.isArray(polygons) || polygons.length === 0) {
        throw this.invalid(
          'INVALID_GEOMETRY',
          `Регіон ${index + 1} не має геометрії.`,
        );
      }
      for (const polygon of polygons) {
        if (!Array.isArray(polygon) || polygon.length === 0)
          throw this.invalid('INVALID_GEOMETRY', 'Полігон не має кілець.');
        for (const ring of polygon) {
          if (!Array.isArray(ring) || ring.length < 4)
            throw this.invalid(
              'INVALID_GEOMETRY',
              'Кільце полігона повинно мати щонайменше чотири точки.',
            );
          for (const position of ring) {
            if (
              !Array.isArray(position) ||
              position.length < 2 ||
              !this.coordinate(position[0], -180, 180) ||
              !this.coordinate(position[1], -90, 90)
            ) {
              throw this.invalid(
                'INVALID_COORDINATES',
                'Координати повинні бути у WGS84: longitude −180…180, latitude −90…90.',
              );
            }
            vertices += 1;
          }
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
            throw this.invalid(
              'OPEN_POLYGON_RING',
              'Кожне кільце полігона має бути замкненим.',
            );
          }
          if (this.ringSelfIntersects(ring)) {
            throw this.invalid(
              'SELF_INTERSECTING_POLYGON',
              `Регіон ${index + 1} має самоперетин контуру.`,
            );
          }
        }
      }
      if (requireCanonical) {
        const id = feature.properties?.[REGION_ID_PROPERTY];
        const name = feature.properties?.name;
        if (
          typeof id !== 'string' ||
          !id ||
          ids.has(id) ||
          typeof name !== 'string' ||
          !name
        ) {
          throw this.invalid(
            'INVALID_NORMALIZED_GEOJSON',
            'Не вдалося нормалізувати ідентифікатори або назви регіонів.',
          );
        }
        ids.add(id);
      }
    }
    return vertices;
  }

  private async simplify(
    collection: FeatureCollection,
    initialVertices: number,
  ): Promise<{ output: Buffer<ArrayBufferLike>; vertexCount: number }> {
    let percentage = Math.min(
      90,
      Math.max(1, Math.floor((TARGET_VERTICES / initialVertices) * 90)),
    );
    let latest: Buffer<ArrayBufferLike> = Buffer.from(
      JSON.stringify(collection),
    );
    let latestVertices = initialVertices;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await applyCommands(
        `-i input.geojson -simplify ${percentage}% keep-shapes -clean -o format=geojson output.geojson`,
        { 'input.geojson': JSON.stringify(collection) },
      );
      const content = result['output.geojson'];
      if (typeof content !== 'string' && !Buffer.isBuffer(content)) {
        throw this.invalid(
          'GEOJSON_OPTIMIZATION_FAILED',
          'Не вдалося оптимізувати карту.',
        );
      }
      latest = Buffer.isBuffer(content) ? content : Buffer.from(content);
      latestVertices = this.validateAndCount(this.parse(latest));
      if (
        latest.byteLength <= TARGET_BYTES &&
        latestVertices <= TARGET_VERTICES
      )
        break;
      percentage = Math.max(0.2, percentage / 2);
    }
    return { output: latest, vertexCount: latestVertices };
  }

  private calculateBounds(collection: FeatureCollection) {
    let west = 180;
    let south = 90;
    let east = -180;
    let north = -90;
    const visit = (value: unknown): void => {
      if (!Array.isArray(value)) return;
      if (
        value.length >= 2 &&
        typeof value[0] === 'number' &&
        typeof value[1] === 'number'
      ) {
        west = Math.min(west, value[0]);
        east = Math.max(east, value[0]);
        south = Math.min(south, value[1]);
        north = Math.max(north, value[1]);
        return;
      }
      value.forEach(visit);
    };
    collection.features.forEach((feature) =>
      visit(feature.geometry.coordinates),
    );
    if (west >= east || south >= north)
      throw this.invalid(
        'INVALID_BOUNDS',
        'Карта має порожні або некоректні межі.',
      );
    return { west, south, east, north };
  }

  private viewport(bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  }) {
    const span = Math.max(
      bounds.east - bounds.west,
      (bounds.north - bounds.south) * 1.7,
      0.01,
    );
    return {
      longitude: (bounds.west + bounds.east) / 2,
      latitude: (bounds.south + bounds.north) / 2,
      zoom: Math.max(0, Math.min(12, Math.log2(360 / span) - 0.35)),
    };
  }

  private coordinate(
    value: unknown,
    min: number,
    max: number,
  ): value is number {
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max
    );
  }

  private ringSelfIntersects(ring: Position[]): boolean {
    const lastSegment = ring.length - 2;
    for (let left = 0; left <= lastSegment; left += 1) {
      for (let right = left + 1; right <= lastSegment; right += 1) {
        if (right === left + 1 || (left === 0 && right === lastSegment))
          continue;
        const a = ring[left];
        const b = ring[left + 1];
        const c = ring[right];
        const d = ring[right + 1];
        if (a && b && c && d && this.segmentsIntersect(a, b, c, d)) return true;
      }
    }
    return false;
  }

  private segmentsIntersect(
    a: Position,
    b: Position,
    c: Position,
    d: Position,
  ): boolean {
    const orientation = (p: Position, q: Position, r: Position) =>
      (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
    const onSegment = (p: Position, q: Position, r: Position) =>
      q[0] >= Math.min(p[0], r[0]) &&
      q[0] <= Math.max(p[0], r[0]) &&
      q[1] >= Math.min(p[1], r[1]) &&
      q[1] <= Math.max(p[1], r[1]);
    const first = orientation(a, b, c);
    const second = orientation(a, b, d);
    const third = orientation(c, d, a);
    const fourth = orientation(c, d, b);
    const epsilon = 1e-12;
    if (
      ((first > epsilon && second < -epsilon) ||
        (first < -epsilon && second > epsilon)) &&
      ((third > epsilon && fourth < -epsilon) ||
        (third < -epsilon && fourth > epsilon))
    )
      return true;
    if (Math.abs(first) <= epsilon && onSegment(a, c, b)) return true;
    if (Math.abs(second) <= epsilon && onSegment(a, d, b)) return true;
    if (Math.abs(third) <= epsilon && onSegment(c, a, d)) return true;
    return Math.abs(fourth) <= epsilon && onSegment(c, b, d);
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private invalid(code: string, message: string): BadRequestException {
    return new BadRequestException({ code, message });
  }
}
