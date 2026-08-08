import {
  WRITTEN_ABSOLUTE_MAX_TEXT_LENGTH,
  createAssignmentValidationDefaults,
  validateAssignmentDraftPublicConfig,
  validateAssignmentPublishPayload,
  validateAssignmentSolution,
  validateAssignmentStudentResponse,
  writtenDraftPublicConfigSchema,
  writtenPublishPublicConfigSchema,
  writtenSolutionSchema,
  writtenStudentResponseSchema,
} from '../../../src/assignments/validation';

const rubricId = '123e4567-e89b-42d3-a456-426614174000';
const attachmentId = '223e4567-e89b-42d3-a456-426614174000';

const validPublicConfig = {
  responseMode: 'LONG',
  minLength: 10,
  maxLength: 2_000,
  allowAttachments: true,
  rubric: [
    {
      id: rubricId,
      title: 'Аргументація',
      description: 'Думка підкріплена доказами.',
      weight: 1,
    },
  ],
};

describe('WRITTEN assignment validation', () => {
  it('provides fresh, publishable defaults', () => {
    const first = createAssignmentValidationDefaults('WRITTEN', 1);
    const second = createAssignmentValidationDefaults('WRITTEN', 1);

    expect(first).toEqual({
      success: true,
      data: {
        publicConfig: {
          responseMode: 'LONG',
          minLength: 0,
          maxLength: WRITTEN_ABSOLUTE_MAX_TEXT_LENGTH,
          allowAttachments: true,
          rubric: [],
        },
        gradingConfig: { mode: 'MANUAL' },
      },
    });
    expect(second).toEqual(first);

    if (first.success && second.success) {
      expect(first.data.publicConfig).not.toBe(second.data.publicConfig);
    }
  });

  it('keeps draft config incomplete while validating fields that are present', () => {
    expect(writtenDraftPublicConfigSchema.safeParse({}).success).toBe(true);
    const unfinishedRubric = {
      ...validPublicConfig,
      rubric: [
        {
          id: rubricId,
          title: '',
          description: '',
          weight: 1,
        },
      ],
    };
    expect(
      writtenDraftPublicConfigSchema.safeParse(unfinishedRubric).success,
    ).toBe(true);
    expect(
      writtenPublishPublicConfigSchema.safeParse(unfinishedRubric).success,
    ).toBe(false);
    expect(
      validateAssignmentDraftPublicConfig('WRITTEN', 1, {
        minLength: 100,
        maxLength: 10,
      }),
    ).toEqual({
      success: false,
      issues: [
        {
          path: ['minLength'],
          code: 'MIN_LENGTH_EXCEEDS_MAX_LENGTH',
          message: 'Minimum length cannot exceed maximum length.',
        },
      ],
    });
  });

  it('requires a complete public config and manual solution when publishing', () => {
    expect(
      validateAssignmentPublishPayload('WRITTEN', 1, {
        publicConfig: validPublicConfig,
        gradingConfig: { mode: 'MANUAL' },
      }),
    ).toEqual({
      success: true,
      data: {
        publicConfig: validPublicConfig,
        gradingConfig: { mode: 'MANUAL' },
      },
    });

    expect(
      validateAssignmentPublishPayload('WRITTEN', 1, {
        publicConfig: {},
        gradingConfig: { mode: 'AUTO', correctText: 'secret answer' },
      }),
    ).toMatchObject({ success: false });
  });

  it.each([
    [writtenDraftPublicConfigSchema, { unknown: true }],
    [writtenPublishPublicConfigSchema, { ...validPublicConfig, unknown: true }],
    [writtenSolutionSchema, { mode: 'MANUAL', correctText: 'secret answer' }],
    [
      writtenStudentResponseSchema,
      { text: 'Відповідь', attachmentIds: [], unknown: true },
    ],
  ])('rejects unknown properties in every schema', (schema, input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });

  it('rejects duplicate stable IDs in rubric and response attachments', () => {
    const configResult = validateAssignmentPublishPayload('WRITTEN', 1, {
      publicConfig: {
        ...validPublicConfig,
        rubric: [validPublicConfig.rubric[0], validPublicConfig.rubric[0]],
      },
      gradingConfig: { mode: 'MANUAL' },
    });
    const responseResult = validateAssignmentStudentResponse('WRITTEN', 1, {
      text: 'Змістовна відповідь',
      attachmentIds: [attachmentId, attachmentId],
    });

    expect(configResult).toMatchObject({
      success: false,
      issues: [
        {
          path: ['publicConfig', 'rubric', 1, 'id'],
          code: 'DUPLICATE_ID',
        },
      ],
    });
    expect(responseResult).toMatchObject({
      success: false,
      issues: [
        {
          path: ['attachmentIds', 1],
          code: 'DUPLICATE_ID',
        },
      ],
    });
  });

  it('checks a student response against the published WRITTEN config', () => {
    expect(
      validateAssignmentStudentResponse(
        'WRITTEN',
        1,
        { text: 'short', attachmentIds: [attachmentId] },
        {
          ...validPublicConfig,
          allowAttachments: false,
        },
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          path: ['text'],
          code: 'TEXT_TOO_SHORT',
          message: 'Text is shorter than the configured minimum.',
        },
        {
          path: ['attachmentIds'],
          code: 'ATTACHMENTS_NOT_ALLOWED',
          message: 'Attachments are not allowed for this assignment.',
        },
      ],
    });
  });

  it('returns safe structured failures for unsupported types and versions', () => {
    expect(validateAssignmentSolution('MAP_POINT', 1, {})).toEqual({
      success: false,
      issues: [
        {
          path: ['type'],
          code: 'UNSUPPORTED_ASSIGNMENT_TYPE',
          message: 'Assignment type is not supported.',
        },
      ],
    });
    expect(validateAssignmentSolution('WRITTEN', 99, {})).toEqual({
      success: false,
      issues: [
        {
          path: ['schemaVersion'],
          code: 'UNSUPPORTED_SCHEMA_VERSION',
          message: 'Assignment schema version is not supported.',
        },
      ],
    });
  });

  it('normalizes errors without echoing private grading values', () => {
    const secret = 'do-not-leak-this-answer';
    const result = validateAssignmentSolution('WRITTEN', 1, {
      mode: 'AUTO',
      correctText: secret,
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
    if (result.success) {
      throw new Error('Expected solution validation to fail');
    }
    expect(
      result.issues.find((issue) => issue.path.join('.') === 'mode'),
    ).toMatchObject({ code: 'INVALID_VALUE' });
  });
});
