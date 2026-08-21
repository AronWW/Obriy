import { AssignmentType } from '@prisma/client';
import { gradeOrderingResponse } from '../../../src/assignments/grading/ordering-grading';
import {
  createAssignmentValidationDefaults,
  validateAssignmentDraftPublicConfig,
  validateAssignmentPublishPayload,
  validateAssignmentStudentResponse,
} from '../../../src/assignments/validation';

const itemA = '123e4567-e89b-42d3-a456-426614174000';
const itemB = '223e4567-e89b-42d3-a456-426614174000';
const itemC = '323e4567-e89b-42d3-a456-426614174000';
const itemD = '423e4567-e89b-42d3-a456-426614174000';
const missing = '523e4567-e89b-42d3-a456-426614174000';
const correctOrderIds = [itemA, itemB, itemC, itemD];
const publicConfig = {
  items: [
    { id: itemA, text: 'First' },
    { id: itemB, text: 'Second' },
    { id: itemC, text: 'Third' },
    { id: itemD, text: 'Fourth' },
  ],
};

describe('ordering assignment validation and grading', () => {
  it('creates an incomplete partial-credit draft by default', () => {
    expect(createAssignmentValidationDefaults('ORDERING', 1)).toEqual({
      success: true,
      data: {
        publicConfig: { items: [] },
        gradingConfig: { correctOrderIds: [], scoringMode: 'PARTIAL' },
      },
    });
    expect(
      validateAssignmentDraftPublicConfig('ORDERING', 1, {
        items: [{ id: itemA, text: '' }],
      }),
    ).toMatchObject({ success: true });
  });

  it('publishes a complete unique correct order', () => {
    expect(
      validateAssignmentPublishPayload('ORDERING', 1, {
        publicConfig,
        gradingConfig: { correctOrderIds, scoringMode: 'PARTIAL' },
      }),
    ).toMatchObject({ success: true });
  });

  it('rejects missing, duplicate, and unknown correct-order items', () => {
    expect(
      validateAssignmentPublishPayload('ORDERING', 1, {
        publicConfig,
        gradingConfig: {
          correctOrderIds: [itemA, itemB, itemC],
          scoringMode: 'PARTIAL',
        },
      }),
    ).toMatchObject({ success: false });
    expect(
      validateAssignmentPublishPayload('ORDERING', 1, {
        publicConfig,
        gradingConfig: {
          correctOrderIds: [itemA, itemA, itemC, itemD],
          scoringMode: 'PARTIAL',
        },
      }),
    ).toMatchObject({ success: false });
    expect(
      validateAssignmentStudentResponse(
        'ORDERING',
        1,
        { orderedItemIds: [itemA, missing] },
        publicConfig,
      ),
    ).toMatchObject({ success: false });
  });

  it('allows a partial unique student draft', () => {
    expect(
      validateAssignmentStudentResponse(
        'ORDERING',
        1,
        { orderedItemIds: [itemC, itemA] },
        publicConfig,
      ),
    ).toMatchObject({ success: true });
  });

  it('awards pairwise partial credit for one adjacent swap', () => {
    expect(
      gradeOrderingResponse({
        type: AssignmentType.ORDERING,
        publicConfig,
        gradingConfig: { correctOrderIds, scoringMode: 'PARTIAL' },
        responseData: {
          orderedItemIds: [itemA, itemC, itemB, itemD],
        },
        maxPoints: 6,
      }),
    ).toEqual({
      scorePoints: 5,
      scorePercent: 83.33,
      isCorrect: false,
      gradingData: {
        correctRelationCount: 5,
        totalRelationCount: 6,
        creditFraction: 5 / 6,
        scoringMode: 'PARTIAL',
      },
    });
  });

  it('supports all-or-nothing and fully correct grading', () => {
    const baseInput = {
      type: AssignmentType.ORDERING,
      publicConfig,
      gradingConfig: {
        correctOrderIds,
        scoringMode: 'ALL_OR_NOTHING' as const,
      },
      maxPoints: 4,
    };
    expect(
      gradeOrderingResponse({
        ...baseInput,
        responseData: { orderedItemIds: [itemA, itemC, itemB, itemD] },
      }),
    ).toMatchObject({ scorePoints: 0, scorePercent: 0, isCorrect: false });
    expect(
      gradeOrderingResponse({
        ...baseInput,
        responseData: { orderedItemIds: correctOrderIds },
      }),
    ).toMatchObject({ scorePoints: 4, scorePercent: 100, isCorrect: true });
  });
});
