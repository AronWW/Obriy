import { AssignmentType } from '@prisma/client';
import {
  gradeMapPointResponse,
  haversineDistanceKm,
} from '../../../src/assignments/grading/map-point-grading';
import {
  createAssignmentValidationDefaults,
  validateAssignmentDraftPublicConfig,
  validateAssignmentPublishPayload,
  validateAssignmentStudentResponse,
} from '../../../src/assignments/validation';

describe('MAP_POINT validation and grading', () => {
  const publicConfig = { initialProjection: 'MERCATOR' };
  const target = { longitude: 30.5234, latitude: 50.4501 };

  it('creates an intentionally incomplete draft with a 100 km radius', () => {
    expect(
      createAssignmentValidationDefaults(AssignmentType.MAP_POINT, 1),
    ).toEqual({
      success: true,
      data: {
        publicConfig,
        gradingConfig: { target: null, radiusKm: 100 },
      },
    });
  });

  it('validates the projection, coordinates and radius boundaries', () => {
    expect(
      validateAssignmentDraftPublicConfig(AssignmentType.MAP_POINT, 1, {
        initialProjection: 'GLOBE',
      }),
    ).toMatchObject({ success: true });
    expect(
      validateAssignmentPublishPayload(AssignmentType.MAP_POINT, 1, {
        publicConfig,
        gradingConfig: { target, radiusKm: 1 },
      }),
    ).toMatchObject({ success: true });
    expect(
      validateAssignmentPublishPayload(AssignmentType.MAP_POINT, 1, {
        publicConfig,
        gradingConfig: { target, radiusKm: 5_000 },
      }),
    ).toMatchObject({ success: true });
    expect(
      validateAssignmentPublishPayload(AssignmentType.MAP_POINT, 1, {
        publicConfig,
        gradingConfig: { target: null, radiusKm: 100 },
      }).success,
    ).toBe(false);
    expect(
      validateAssignmentPublishPayload(AssignmentType.MAP_POINT, 1, {
        publicConfig,
        gradingConfig: { target, radiusKm: 0 },
      }).success,
    ).toBe(false);
    expect(
      validateAssignmentStudentResponse(
        AssignmentType.MAP_POINT,
        1,
        { longitude: 181, latitude: 0 },
        publicConfig,
      ).success,
    ).toBe(false);
  });

  it('awards full points inside the radius and zero outside it', () => {
    expect(grade({ ...target }, 100)).toMatchObject({
      scorePoints: 5,
      scorePercent: 100,
      isCorrect: true,
      gradingData: { distanceKm: 0, withinRadius: true },
    });
    expect(grade({ longitude: 0, latitude: 0 }, 1)).toMatchObject({
      scorePoints: 0,
      scorePercent: 0,
      isCorrect: false,
      gradingData: { withinRadius: false },
    });
  });

  it('treats a point exactly on the radius as correct', () => {
    const response = { longitude: 30.6, latitude: 50.45 };
    const radiusKm = haversineDistanceKm(response, target);

    expect(grade(response, radiusKm)).toMatchObject({
      scorePoints: 5,
      isCorrect: true,
      gradingData: { withinRadius: true },
    });
  });

  it('uses the short path across the antimeridian', () => {
    const distanceKm = haversineDistanceKm(
      { longitude: 179.9, latitude: 0 },
      { longitude: -179.9, latitude: 0 },
    );

    expect(distanceKm).toBeGreaterThan(22);
    expect(distanceKm).toBeLessThan(23);
  });

  function grade(
    responseData: { longitude: number; latitude: number },
    radiusKm: number,
  ) {
    return gradeMapPointResponse({
      type: AssignmentType.MAP_POINT,
      publicConfig,
      gradingConfig: { target, radiusKm },
      responseData,
      maxPoints: 5,
    });
  }
});
