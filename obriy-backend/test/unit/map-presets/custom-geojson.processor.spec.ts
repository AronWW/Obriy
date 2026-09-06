import { CustomGeoJsonProcessor } from '../../../src/map-presets/custom-geojson.processor';

describe('CustomGeoJsonProcessor', () => {
  const processor = new CustomGeoJsonProcessor();

  it('detects label properties and normalizes IDs, names, bounds and viewport', async () => {
    const source = collection([
      feature('Alpha', [0, 0, 2, 2], 'a'),
      feature('Beta', [2, 0, 4, 2], 'b'),
    ]);
    expect(processor.inspect(buffer(source))).toEqual({
      labelProperties: ['title'],
      featureCount: 2,
      vertexCount: 10,
    });
    const result = await processor.process(buffer(source), 'title');
    const normalized = JSON.parse(result.buffer.toString()) as {
      features: Array<{ properties: Record<string, string> }>;
    };
    expect(normalized.features.map((item) => item.properties)).toEqual([
      { regionId: 'a', name: 'Alpha' },
      { regionId: 'b', name: 'Beta' },
    ]);
    expect(result.bounds).toEqual({ west: 0, south: 0, east: 4, north: 2 });
    expect(result.defaultViewport.longitude).toBe(2);
  });

  it('generates unique IDs when source feature IDs are absent', async () => {
    const result = await processor.process(
      buffer(collection([feature('Alpha', [0, 0, 1, 1])])),
      'title',
    );
    expect(result.buffer.toString()).toContain('"regionId":"region-1"');
  });

  it('preserves canonical region IDs during editor autosaves', async () => {
    const source = collection([
      {
        ...feature('Alpha', [0, 0, 1, 1]),
        properties: { regionId: 'stable-alpha', name: 'Alpha' },
      },
    ]);
    const result = await processor.process(buffer(source), 'name');
    expect(result.buffer.toString()).toContain('"regionId":"stable-alpha"');
  });

  it('rejects self-intersecting polygon rings', async () => {
    const source = collection([
      {
        type: 'Feature',
        properties: { title: 'Bow tie' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [2, 2],
              [0, 2],
              [2, 0],
              [0, 0],
            ],
          ],
        },
      },
    ]);
    await expect(
      processor.process(buffer(source), 'title'),
    ).rejects.toMatchObject({
      response: { code: 'SELF_INTERSECTING_POLYGON' },
    });
  });

  it.each([
    [{ type: 'FeatureCollection', features: [] }, 'INVALID_FEATURE_COUNT'],
    [
      collection([
        {
          ...feature('Alpha', [0, 0, 1, 1]),
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ]),
      'UNSUPPORTED_GEOMETRY',
    ],
    [collection([feature('', [0, 0, 1, 1])]), 'INVALID_LABEL_PROPERTY'],
  ])('rejects invalid map data', async (source, code) => {
    await expect(
      processor.process(buffer(source), 'title'),
    ).rejects.toMatchObject({
      response: { code },
    });
  });
});

function collection(features: unknown[]) {
  return { type: 'FeatureCollection', features };
}

function feature(
  name: string,
  bounds: [number, number, number, number],
  id?: string,
) {
  const [west, south, east, north] = bounds;
  return {
    type: 'Feature',
    ...(id ? { id } : {}),
    properties: { title: name },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  };
}

function buffer(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value));
}
