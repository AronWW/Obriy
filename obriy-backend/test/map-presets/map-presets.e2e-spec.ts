import { JwtService } from '@nestjs/jwt';
import {
  Locale,
  MapPresetSourceType,
  MapPresetStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';
import {
  BUILT_IN_MAP_PRESET_KEYS,
  BUILT_IN_MAP_PRESETS,
} from '../../prisma/map-presets.data';
import { seedMapPresets } from '../../prisma/seed-maps';
import { getResponseBody, getStringField } from '../helpers/auth-test.helpers';
import {
  AuthTestContext,
  closeAuthTestContext,
  createAuthTestContext,
} from '../helpers/create-test-app';

jest.setTimeout(30_000);

describe('Map presets (e2e)', () => {
  let context: AuthTestContext;
  let accessToken = '';
  let archivedPresetId = '';
  const email = `map-presets.teacher.${Date.now()}@example.com`;

  beforeAll(async () => {
    context = await createAuthTestContext();
    const user = await context.prisma.user.create({
      data: {
        email,
        role: UserRole.TEACHER,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        profile: {
          create: { displayName: 'Map teacher', preferredLocale: Locale.UK },
        },
      },
    });
    accessToken = await context.app.get(JwtService).signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );

    await seedMapPresets(context.prisma);
    await seedMapPresets(context.prisma);
    const archived = await context.prisma.mapPreset.create({
      data: {
        key: `e2e-archived-${Date.now()}`,
        name: 'Archived map',
        contentLocale: Locale.EN,
        sourceType: MapPresetSourceType.BUILT_IN,
        status: MapPresetStatus.ARCHIVED,
        geojsonUrl: '/maps/archived.geojson',
        idProperty: 'featureId',
        attribution: 'Test data',
        bounds: { west: 0, south: 0, east: 1, north: 1 },
        defaultViewport: { longitude: 0.5, latitude: 0.5, zoom: 4 },
        archivedAt: new Date(),
      },
    });
    archivedPresetId = archived.id;
  });

  afterAll(async () => {
    await context.prisma.mapPreset.deleteMany({
      where: { id: archivedPresetId },
    });
    await closeAuthTestContext(context, [email]);
  });

  it('requires authentication', async () => {
    await request(context.app.getHttpServer()).get('/map-presets').expect(401);
  });

  it('seeds built-ins idempotently and lists only active presets', async () => {
    const count = await context.prisma.mapPreset.count({
      where: { key: { in: BUILT_IN_MAP_PRESET_KEYS } },
    });
    expect(count).toBe(BUILT_IN_MAP_PRESETS.length);

    const response = await request(context.app.getHttpServer())
      .get('/map-presets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body: unknown = response.body;
    if (!Array.isArray(body)) throw new Error('Expected a preset array');

    expect(body).toHaveLength(BUILT_IN_MAP_PRESETS.length);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'world-adm0',
          geojsonUrl: '/maps/world-adm0.geojson',
          idProperty: 'featureId',
        }),
        expect.objectContaining({
          key: 'ukraine-adm1',
          geojsonUrl: '/maps/ukraine-adm1.geojson',
        }),
      ]),
    );
    expect(JSON.stringify(body)).not.toContain('Archived map');
  });

  it('returns active details and hides archived presets behind a 404', async () => {
    const preset = await context.prisma.mapPreset.findUniqueOrThrow({
      where: { key: 'ukraine-adm1' },
    });
    await request(context.app.getHttpServer())
      .get(`/map-presets/${preset.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        const body = getResponseBody(response);
        expect(body.id).toBe(preset.id);
        const bounds = body.bounds;
        if (typeof bounds !== 'object' || bounds === null) {
          throw new Error('Expected map bounds');
        }
        expect(bounds).toMatchObject({ west: 21.8, east: 40.3 });
      });

    await request(context.app.getHttpServer())
      .get(`/map-presets/${archivedPresetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404)
      .expect((response) => {
        expect(getStringField(response, 'code')).toBe('MAP_PRESET_NOT_FOUND');
      });
  });
});
