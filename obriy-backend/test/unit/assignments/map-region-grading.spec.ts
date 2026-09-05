import { AssignmentType } from '@prisma/client';
import { gradeMapRegionResponse } from '../../../src/assignments/grading/map-region-grading';
import {
  createAssignmentValidationDefaults,
  validateAssignmentPublishPayload,
  validateAssignmentStudentResponse,
} from '../../../src/assignments/validation';

describe('MAP_REGION validation and grading', () => {
  const publicConfig = { initialProjection: 'MERCATOR' };

  it('creates an intentionally incomplete draft', () => {
    expect(
      createAssignmentValidationDefaults(AssignmentType.MAP_REGION, 1),
    ).toEqual({
      success: true,
      data: {
        publicConfig,
        gradingConfig: { correctRegionId: null },
      },
    });
  });

  it('requires a non-empty bounded region identifier for publication', () => {
    expect(
      validateAssignmentPublishPayload(AssignmentType.MAP_REGION, 1, {
        publicConfig: { initialProjection: 'GLOBE' },
        gradingConfig: { correctRegionId: 'IND' },
      }),
    ).toMatchObject({ success: true });
    expect(
      validateAssignmentPublishPayload(AssignmentType.MAP_REGION, 1, {
        publicConfig,
        gradingConfig: { correctRegionId: null },
      }).success,
    ).toBe(false);
    expect(
      validateAssignmentPublishPayload(AssignmentType.MAP_REGION, 1, {
        publicConfig,
        gradingConfig: { correctRegionId: '   ' },
      }).success,
    ).toBe(false);
    expect(
      validateAssignmentStudentResponse(
        AssignmentType.MAP_REGION,
        1,
        { regionId: 'x'.repeat(201) },
        publicConfig,
      ).success,
    ).toBe(false);
  });

  it('awards full points only for an exact feature ID match', () => {
    expect(grade('IND')).toEqual({
      scorePoints: 7,
      scorePercent: 100,
      isCorrect: true,
      gradingData: { matches: true },
    });
    expect(grade('PRI')).toEqual({
      scorePoints: 0,
      scorePercent: 0,
      isCorrect: false,
      gradingData: { matches: false },
    });
  });

  function grade(regionId: string) {
    return gradeMapRegionResponse({
      type: AssignmentType.MAP_REGION,
      publicConfig,
      gradingConfig: { correctRegionId: 'IND' },
      responseData: { regionId },
      maxPoints: 7,
    });
  }
});
