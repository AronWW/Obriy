import { AssignmentType } from '@prisma/client';
import { gradeChoiceResponse } from '../../../src/assignments/grading/choice-grading';
import {
  createAssignmentValidationDefaults,
  validateAssignmentPublishPayload,
  validateAssignmentStudentResponse,
} from '../../../src/assignments/validation';

const optionA = '123e4567-e89b-42d3-a456-426614174000';
const optionB = '223e4567-e89b-42d3-a456-426614174000';
const optionC = '323e4567-e89b-42d3-a456-426614174000';
const optionD = '423e4567-e89b-42d3-a456-426614174000';
const publicConfig = {
  options: [
    { id: optionA, text: 'A' },
    { id: optionB, text: 'B' },
    { id: optionC, text: 'C' },
    { id: optionD, text: 'D' },
  ],
  shuffleOptions: false,
};

describe('choice assignment validation and grading', () => {
  it('creates incomplete but editable choice drafts', () => {
    expect(createAssignmentValidationDefaults('SINGLE_CHOICE', 1)).toEqual({
      success: true,
      data: {
        publicConfig: { options: [], shuffleOptions: false },
        gradingConfig: {
          correctOptionIds: [],
          scoringMode: 'ALL_OR_NOTHING',
        },
      },
    });
    expect(createAssignmentValidationDefaults('MULTIPLE_CHOICE', 1)).toEqual({
      success: true,
      data: {
        publicConfig: { options: [], shuffleOptions: false },
        gradingConfig: {
          correctOptionIds: [],
          scoringMode: 'ALL_OR_NOTHING',
        },
      },
    });
  });

  it('requires valid correct option references on publish', () => {
    expect(
      validateAssignmentPublishPayload('SINGLE_CHOICE', 1, {
        publicConfig,
        gradingConfig: {
          correctOptionIds: [optionA],
          scoringMode: 'ALL_OR_NOTHING',
        },
      }),
    ).toMatchObject({ success: true });
    expect(
      validateAssignmentPublishPayload('MULTIPLE_CHOICE', 1, {
        publicConfig,
        gradingConfig: {
          correctOptionIds: ['523e4567-e89b-42d3-a456-426614174000'],
          scoringMode: 'PARTIAL',
        },
      }),
    ).toMatchObject({
      success: false,
      issues: [
        {
          path: ['gradingConfig', 'correctOptionIds', 0],
          code: 'INVALID_CONFIGURATION',
        },
      ],
    });
  });

  it('rejects unavailable options and multiple selections for single choice', () => {
    expect(
      validateAssignmentStudentResponse(
        'SINGLE_CHOICE',
        1,
        { selectedOptionIds: [optionA, optionB] },
        publicConfig,
      ),
    ).toMatchObject({ success: false });
    expect(
      validateAssignmentStudentResponse(
        'MULTIPLE_CHOICE',
        1,
        {
          selectedOptionIds: ['523e4567-e89b-42d3-a456-426614174000'],
        },
        publicConfig,
      ),
    ).toMatchObject({ success: false });
  });

  it('grades single choice all-or-nothing', () => {
    expect(
      gradeChoiceResponse({
        type: AssignmentType.SINGLE_CHOICE,
        publicConfig,
        gradingConfig: {
          correctOptionIds: [optionA],
          scoringMode: 'ALL_OR_NOTHING',
        },
        responseData: { selectedOptionIds: [optionA] },
        maxPoints: 5,
      }),
    ).toMatchObject({ scorePoints: 5, scorePercent: 100, isCorrect: true });
    expect(
      gradeChoiceResponse({
        type: AssignmentType.SINGLE_CHOICE,
        publicConfig,
        gradingConfig: {
          correctOptionIds: [optionA],
          scoringMode: 'ALL_OR_NOTHING',
        },
        responseData: { selectedOptionIds: [optionB] },
        maxPoints: 5,
      }),
    ).toMatchObject({ scorePoints: 0, scorePercent: 0, isCorrect: false });
  });

  it('supports teacher-selected partial credit without rewarding select-all', () => {
    const result = gradeChoiceResponse({
      type: AssignmentType.MULTIPLE_CHOICE,
      publicConfig,
      gradingConfig: {
        correctOptionIds: [optionA, optionB, optionC],
        scoringMode: 'PARTIAL',
      },
      responseData: { selectedOptionIds: [optionA, optionB, optionD] },
      maxPoints: 6,
    });
    expect(result).toMatchObject({
      scorePoints: 0,
      scorePercent: 0,
      isCorrect: false,
      gradingData: {
        correctSelectedCount: 2,
        incorrectSelectedCount: 1,
        expectedCorrectCount: 3,
        creditFraction: 0,
        scoringMode: 'PARTIAL',
      },
    });

    expect(
      gradeChoiceResponse({
        type: AssignmentType.MULTIPLE_CHOICE,
        publicConfig,
        gradingConfig: {
          correctOptionIds: [optionA, optionB, optionC],
          scoringMode: 'PARTIAL',
        },
        responseData: { selectedOptionIds: [optionA] },
        maxPoints: 6,
      }),
    ).toMatchObject({ scorePoints: 2, scorePercent: 33.33 });

    expect(
      gradeChoiceResponse({
        type: AssignmentType.MULTIPLE_CHOICE,
        publicConfig,
        gradingConfig: {
          correctOptionIds: [optionA, optionB, optionC],
          scoringMode: 'PARTIAL',
        },
        responseData: {
          selectedOptionIds: [optionA, optionB, optionC, optionD],
        },
        maxPoints: 6,
      }),
    ).toMatchObject({ scorePoints: 0, scorePercent: 0 });
  });
});
