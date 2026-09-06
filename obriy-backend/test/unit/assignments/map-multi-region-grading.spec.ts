import { AssignmentType } from '@prisma/client';
import { gradeMapMultiRegionResponse } from '../../../src/assignments/grading/map-multi-region-grading';
import {
  createAssignmentValidationDefaults,
  validateAssignmentPublishPayload,
  validateAssignmentStudentResponse,
} from '../../../src/assignments/validation';

describe('MAP_MULTI_REGION validation and grading', () => {
  const publicConfig = {
    initialProjection: 'MERCATOR',
    requiredSelectionCount: 3,
  };
  const correctRegionIds = ['FRA', 'DEU', 'ITA'];

  it('provides incomplete draft defaults and enforces publish boundaries', () => {
    expect(
      createAssignmentValidationDefaults(AssignmentType.MAP_MULTI_REGION, 1),
    ).toEqual({
      success: true,
      data: {
        publicConfig: {
          initialProjection: 'MERCATOR',
          requiredSelectionCount: 0,
        },
        gradingConfig: {
          correctRegionIds: [],
          scoringMode: 'ALL_OR_NOTHING',
        },
      },
    });
    expect(
      validateAssignmentPublishPayload(AssignmentType.MAP_MULTI_REGION, 1, {
        publicConfig: {
          initialProjection: 'MERCATOR',
          requiredSelectionCount: 1,
        },
        gradingConfig: {
          correctRegionIds: ['FRA'],
          scoringMode: 'ALL_OR_NOTHING',
        },
      }),
    ).toMatchObject({ success: false });
    expect(
      validateAssignmentPublishPayload(AssignmentType.MAP_MULTI_REGION, 1, {
        publicConfig,
        gradingConfig: {
          correctRegionIds: ['FRA', 'FRA', 'ITA'],
          scoringMode: 'PARTIAL',
        },
      }),
    ).toMatchObject({
      success: false,
      issues: [expect.objectContaining({ code: 'DUPLICATE_ID' })],
    });
    expect(
      validateAssignmentPublishPayload(AssignmentType.MAP_MULTI_REGION, 1, {
        publicConfig: { ...publicConfig, requiredSelectionCount: 2 },
        gradingConfig: {
          correctRegionIds,
          scoringMode: 'PARTIAL',
        },
      }),
    ).toMatchObject({
      success: false,
      issues: [
        expect.objectContaining({
          path: ['publicConfig', 'requiredSelectionCount'],
          code: 'INVALID_CONFIGURATION',
        }),
      ],
    });
  });

  it('rejects duplicate answers and selections above the public limit', () => {
    expect(
      validateAssignmentStudentResponse(
        AssignmentType.MAP_MULTI_REGION,
        1,
        { selectedRegionIds: ['FRA', 'FRA'] },
        publicConfig,
      ),
    ).toMatchObject({
      success: false,
      issues: [expect.objectContaining({ code: 'DUPLICATE_ID' })],
    });
    expect(
      validateAssignmentStudentResponse(
        AssignmentType.MAP_MULTI_REGION,
        1,
        { selectedRegionIds: ['FRA', 'DEU', 'ITA', 'ESP'] },
        publicConfig,
      ),
    ).toMatchObject({
      success: false,
      issues: [expect.objectContaining({ code: 'TOO_BIG' })],
    });
  });

  it.each([
    {
      name: 'awards full credit for the exact set regardless of order',
      scoringMode: 'ALL_OR_NOTHING' as const,
      selectedRegionIds: ['ITA', 'FRA', 'DEU'],
      scorePoints: 9,
      scorePercent: 100,
      isCorrect: true,
    },
    {
      name: 'awards no credit for an incomplete all-or-nothing answer',
      scoringMode: 'ALL_OR_NOTHING' as const,
      selectedRegionIds: ['FRA', 'DEU'],
      scorePoints: 0,
      scorePercent: 0,
      isCorrect: false,
    },
    {
      name: 'awards pairwise partial credit while a wrong choice occupies a slot',
      scoringMode: 'PARTIAL' as const,
      selectedRegionIds: ['FRA', 'DEU', 'ESP'],
      scorePoints: 6,
      scorePercent: 66.67,
      isCorrect: false,
    },
  ])(
    '$name',
    ({
      scoringMode,
      selectedRegionIds,
      scorePoints,
      scorePercent,
      isCorrect,
    }) => {
      expect(
        gradeMapMultiRegionResponse({
          type: AssignmentType.MAP_MULTI_REGION,
          publicConfig,
          gradingConfig: { correctRegionIds, scoringMode },
          responseData: { selectedRegionIds },
          maxPoints: 9,
        }),
      ).toMatchObject({ scorePoints, scorePercent, isCorrect });
    },
  );
});
