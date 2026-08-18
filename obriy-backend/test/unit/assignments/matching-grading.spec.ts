import { AssignmentType } from '@prisma/client';
import { gradeMatchingResponse } from '../../../src/assignments/grading/matching-grading';
import {
  createAssignmentValidationDefaults,
  validateAssignmentDraftPublicConfig,
  validateAssignmentPublishPayload,
  validateAssignmentStudentResponse,
} from '../../../src/assignments/validation';

const leftA = '123e4567-e89b-42d3-a456-426614174000';
const leftB = '223e4567-e89b-42d3-a456-426614174000';
const leftC = '323e4567-e89b-42d3-a456-426614174000';
const rightA = '423e4567-e89b-42d3-a456-426614174000';
const rightB = '523e4567-e89b-42d3-a456-426614174000';
const rightC = '623e4567-e89b-42d3-a456-426614174000';
const distractor = '723e4567-e89b-42d3-a456-426614174000';
const missing = '823e4567-e89b-42d3-a456-426614174000';

const publicConfig = {
  leftItems: [
    { id: leftA, text: 'Україна' },
    { id: leftB, text: 'Франція' },
    { id: leftC, text: 'Італія' },
  ],
  rightItems: [
    { id: rightA, text: 'Київ' },
    { id: rightB, text: 'Париж' },
    { id: rightC, text: 'Рим' },
    { id: distractor, text: 'Варшава' },
  ],
  shuffleRightItems: false,
};

const correctMatches = [
  { leftItemId: leftA, rightItemId: rightA },
  { leftItemId: leftB, rightItemId: rightB },
  { leftItemId: leftC, rightItemId: rightC },
];

describe('matching assignment validation and grading', () => {
  it('creates a flexible incomplete draft with partial scoring by default', () => {
    expect(createAssignmentValidationDefaults('MATCHING', 1)).toEqual({
      success: true,
      data: {
        publicConfig: {
          leftItems: [],
          rightItems: [],
          shuffleRightItems: false,
        },
        gradingConfig: { matches: [], scoringMode: 'PARTIAL' },
      },
    });
    expect(
      validateAssignmentDraftPublicConfig('MATCHING', 1, {
        leftItems: [{ id: leftA, text: '' }],
      }),
    ).toMatchObject({ success: true });
  });

  it('publishes exact one-to-one matches with or without right distractors', () => {
    expect(
      validateAssignmentPublishPayload('MATCHING', 1, {
        publicConfig,
        gradingConfig: {
          matches: correctMatches,
          scoringMode: 'PARTIAL',
        },
      }),
    ).toMatchObject({ success: true });

    expect(
      validateAssignmentPublishPayload('MATCHING', 1, {
        publicConfig: {
          ...publicConfig,
          rightItems: publicConfig.rightItems.slice(0, 3),
        },
        gradingConfig: {
          matches: correctMatches,
          scoringMode: 'ALL_OR_NOTHING',
        },
      }),
    ).toMatchObject({ success: true });
  });

  it('rejects missing pairs, reused right items, and unknown references', () => {
    expect(
      validateAssignmentPublishPayload('MATCHING', 1, {
        publicConfig,
        gradingConfig: {
          matches: correctMatches.slice(0, 2),
          scoringMode: 'PARTIAL',
        },
      }),
    ).toMatchObject({
      success: false,
      issues: [
        {
          path: ['gradingConfig', 'matches', 2],
          code: 'INVALID_CONFIGURATION',
        },
      ],
    });

    expect(
      validateAssignmentPublishPayload('MATCHING', 1, {
        publicConfig,
        gradingConfig: {
          matches: [
            correctMatches[0],
            { leftItemId: leftB, rightItemId: rightA },
            correctMatches[2],
          ],
          scoringMode: 'PARTIAL',
        },
      }),
    ).toMatchObject({
      success: false,
      issues: [
        {
          path: ['gradingConfig', 'matches', 1, 'rightItemId'],
          code: 'DUPLICATE_ID',
        },
      ],
    });

    expect(
      validateAssignmentStudentResponse(
        'MATCHING',
        1,
        { matches: [{ leftItemId: leftA, rightItemId: missing }] },
        publicConfig,
      ),
    ).toMatchObject({
      success: false,
      issues: [
        {
          path: ['matches', 0, 'rightItemId'],
          code: 'INVALID_VALUE',
        },
      ],
    });
  });

  it('accepts partial student drafts while keeping their pairs one-to-one', () => {
    expect(
      validateAssignmentStudentResponse(
        'MATCHING',
        1,
        { matches: [correctMatches[0]] },
        publicConfig,
      ),
    ).toMatchObject({ success: true });

    expect(
      validateAssignmentStudentResponse(
        'MATCHING',
        1,
        {
          matches: [
            correctMatches[0],
            { leftItemId: leftB, rightItemId: rightA },
          ],
        },
        publicConfig,
      ),
    ).toMatchObject({ success: false });
  });

  it('awards equal partial credit per correct left item', () => {
    expect(
      gradeMatchingResponse({
        type: AssignmentType.MATCHING,
        publicConfig,
        gradingConfig: {
          matches: correctMatches,
          scoringMode: 'PARTIAL',
        },
        responseData: {
          matches: [
            correctMatches[0],
            { leftItemId: leftB, rightItemId: distractor },
            correctMatches[2],
          ],
        },
        maxPoints: 6,
      }),
    ).toEqual({
      scorePoints: 4,
      scorePercent: 66.67,
      isCorrect: false,
      gradingData: {
        correctMatchCount: 2,
        incorrectMatchCount: 1,
        expectedMatchCount: 3,
        creditFraction: 2 / 3,
        scoringMode: 'PARTIAL',
      },
    });
  });

  it('supports all-or-nothing scoring and a fully correct result', () => {
    const baseInput = {
      type: AssignmentType.MATCHING,
      publicConfig,
      gradingConfig: {
        matches: correctMatches,
        scoringMode: 'ALL_OR_NOTHING' as const,
      },
      maxPoints: 5,
    };
    expect(
      gradeMatchingResponse({
        ...baseInput,
        responseData: {
          matches: [
            correctMatches[0],
            { leftItemId: leftB, rightItemId: distractor },
            correctMatches[2],
          ],
        },
      }),
    ).toMatchObject({ scorePoints: 0, scorePercent: 0, isCorrect: false });
    expect(
      gradeMatchingResponse({
        ...baseInput,
        responseData: { matches: correctMatches },
      }),
    ).toMatchObject({ scorePoints: 5, scorePercent: 100, isCorrect: true });
  });
});
