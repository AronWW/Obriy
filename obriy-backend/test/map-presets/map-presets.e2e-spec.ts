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
  let otherTeacherToken = '';
  let teacherId = '';
  let archivedPresetId = '';
  let lockedCustomPresetId = '';
  const email = `map-presets.teacher.${Date.now()}@example.com`;
  const otherEmail = `map-presets.other.${Date.now()}@example.com`;

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
    teacherId = user.id;
    accessToken = await context.app.get(JwtService).signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
    const otherTeacher = await context.prisma.user.create({
      data: {
        email: otherEmail,
        role: UserRole.TEACHER,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    otherTeacherToken = await context.app.get(JwtService).signAsync(
      {
        sub: otherTeacher.id,
        email: otherTeacher.email,
        role: otherTeacher.role,
        status: otherTeacher.status,
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
    await context.prisma.mapDraft.deleteMany({ where: { teacherId } });
    await context.prisma.assignment.deleteMany({ where: { teacherId } });
    await context.prisma.mapPreset.deleteMany({
      where: { createdById: teacherId },
    });
    await context.prisma.mapPreset.deleteMany({
      where: { id: archivedPresetId },
    });
    await closeAuthTestContext(context, [email, otherEmail]);
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

  it('creates a private custom map and manages its lifecycle safely', async () => {
    const source = Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'kingdom-a',
            properties: { historicalName: 'Kingdom A' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [10, 40],
                  [20, 40],
                  [20, 50],
                  [10, 50],
                  [10, 40],
                ],
              ],
            },
          },
        ],
      }),
    );
    const inspect = await request(context.app.getHttpServer())
      .post('/map-presets/custom/inspect')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', source, {
        filename: 'europe-1400.geojson',
        contentType: 'application/geo+json',
      })
      .expect(200);
    expect(inspect.body).toMatchObject({
      labelProperties: ['historicalName'],
      featureCount: 1,
      vertexCount: 5,
    });

    const createdResponse = await request(context.app.getHttpServer())
      .post('/map-presets/custom')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('name', 'Europe 1400')
      .field('contentLocale', 'EN')
      .field('labelProperty', 'historicalName')
      .field('periodLabel', '1400')
      .attach('file', source, {
        filename: 'europe-1400.geojson',
        contentType: 'application/geo+json',
      })
      .expect(201);
    const customId = getStringField(createdResponse, 'id');
    lockedCustomPresetId = customId;
    expect(createdResponse.body).toMatchObject({
      name: 'Europe 1400',
      sourceType: 'CUSTOM_GEOJSON',
      baseMapMode: 'NEUTRAL',
      periodLabel: '1400',
      geometryLocked: false,
    });

    const ownerList = await request(context.app.getHttpServer())
      .get('/map-presets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(JSON.stringify(ownerList.body)).toContain(customId);
    const otherList = await request(context.app.getHttpServer())
      .get('/map-presets')
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .expect(200);
    expect(JSON.stringify(otherList.body)).not.toContain(customId);
    await request(context.app.getHttpServer())
      .get(`/map-presets/${customId}`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .expect(404);
    await request(context.app.getHttpServer())
      .get(`/map-presets/${customId}/geojson`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(302)
      .expect('Location', /example\.test\/test\/maps\/map-1\.geojson/);
    await request(context.app.getHttpServer())
      .get(`/map-presets/${customId}/geojson`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .expect(404);

    await request(context.app.getHttpServer())
      .put(`/map-presets/${customId}/geojson`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('labelProperty', 'historicalName')
      .attach('file', source, { filename: 'replacement.geojson' })
      .expect(200);

    await context.prisma.assignment.create({
      data: {
        teacherId,
        type: 'MAP_REGION',
        contentLocale: Locale.EN,
        revisions: {
          create: {
            version: 1,
            title: 'Locked map assignment',
            prompt: 'Choose a kingdom',
            publicConfig: { initialProjection: 'MERCATOR' },
            mapPresetId: customId,
          },
        },
      },
    });
    await request(context.app.getHttpServer())
      .put(`/map-presets/${customId}/geojson`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('labelProperty', 'historicalName')
      .attach('file', source, { filename: 'locked.geojson' })
      .expect(409);

    await request(context.app.getHttpServer())
      .post(`/map-presets/${customId}/archive`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    await request(context.app.getHttpServer())
      .get(`/map-presets/${customId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
    const archivedList = await request(context.app.getHttpServer())
      .get('/map-presets/mine?status=ARCHIVED')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(JSON.stringify(archivedList.body)).toContain(customId);
    await request(context.app.getHttpServer())
      .delete(`/map-presets/${customId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);
    await request(context.app.getHttpServer())
      .post(`/map-presets/${customId}/restore`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
  });

  it('autosaves, isolates and publishes map drafts', async () => {
    const created = await request(context.app.getHttpServer())
      .post('/map-drafts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Draft map', contentLocale: 'EN', periodLabel: '1450' })
      .expect(201);
    const draftId = getStringField(created, 'id');
    expect(created.body).toMatchObject({
      editVersion: 1,
      featureCount: 0,
      geojsonUrl: null,
    });
    await request(context.app.getHttpServer())
      .get(`/map-drafts/${draftId}`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .expect(404);

    const source = Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { regionId: 'realm-a', name: 'Realm A' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [10, 40],
                  [20, 40],
                  [20, 50],
                  [10, 50],
                  [10, 40],
                ],
              ],
            },
          },
        ],
      }),
    );
    const saved = await request(context.app.getHttpServer())
      .put(`/map-drafts/${draftId}/geojson`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('expectedEditVersion', '1')
      .attach('file', source, { filename: 'map.geojson' })
      .expect(200);
    expect(saved.body).toMatchObject({
      editVersion: 2,
      featureCount: 1,
      vertexCount: 5,
    });
    await request(context.app.getHttpServer())
      .patch(`/map-drafts/${draftId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ expectedEditVersion: 1, name: 'Stale name' })
      .expect(409);
    await request(context.app.getHttpServer())
      .get(`/map-drafts/${draftId}/geojson`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(302);

    const published = await request(context.app.getHttpServer())
      .post(`/map-drafts/${draftId}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ expectedEditVersion: 2 })
      .expect(201);
    expect(published.body).toMatchObject({
      preset: {
        name: 'Draft map',
        sourceType: 'CUSTOM_GEOJSON',
        geometryLocked: false,
      },
    });
    await request(context.app.getHttpServer())
      .get(`/map-drafts/${draftId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    const copied = await request(context.app.getHttpServer())
      .post(`/map-drafts/from-preset/${lockedCustomPresetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    const copiedDraftId = getStringField(copied, 'id');
    const copiedPublished = await request(context.app.getHttpServer())
      .post(`/map-drafts/${copiedDraftId}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ expectedEditVersion: 1 })
      .expect(201);
    const copiedBody = getResponseBody(copiedPublished);
    const copiedPreset = copiedBody.preset;
    if (typeof copiedPreset !== 'object' || copiedPreset === null)
      throw new Error('Expected published preset');
    expect((copiedPreset as { id?: unknown }).id).not.toBe(
      lockedCustomPresetId,
    );
  });
});
