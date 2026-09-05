import {
  WRITTEN_DEFAULT_MAX_TEXT_LENGTH,
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
  allowAttachments: false,
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
          maxLength: WRITTEN_DEFAULT_MAX_TEXT_LENGTH,
          allowAttachments: false,
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

  it('keeps response attachments unavailable until their upload flow exists', () => {
    expect(
      validateAssignmentPublishPayload('WRITTEN', 1, {
        publicConfig: { ...validPublicConfig, allowAttachments: true },
        gradingConfig: { mode: 'MANUAL' },
      }),
    ).toMatchObject({
      success: false,
      issues: [
        {
          path: ['publicConfig', 'allowAttachments'],
          code: 'FEATURE_UNAVAILABLE',
        },
      ],
    });

    expect(
      validateAssignmentStudentResponse(
        'WRITTEN',
        1,
        { text: 'A complete response.', attachmentIds: [attachmentId] },
        { ...validPublicConfig, minLength: 0, allowAttachments: true },
      ),
    ).toMatchObject({
      success: false,
      issues: [
        {
          path: ['attachmentIds'],
          code: 'FEATURE_UNAVAILABLE',
        },
      ],
    });
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
    expect(validateAssignmentSolution('MAP_MULTI_REGION', 1, {})).toEqual({
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

describe('MAP_REGION assignment validation', () => {
  it('allows an incomplete draft but requires a region for publishing', () => {
    expect(createAssignmentValidationDefaults('MAP_REGION', 1)).toEqual({
      success: true,
      data: {
        publicConfig: { initialProjection: 'MERCATOR' },
        gradingConfig: { correctRegionId: null },
      },
    });
    expect(
      validateAssignmentSolution('MAP_REGION', 1, {
        correctRegionId: null,
      }),
    ).toEqual({
      success: true,
      data: { correctRegionId: null },
    });

    const result = validateAssignmentPublishPayload('MAP_REGION', 1, {
      publicConfig: { initialProjection: 'GLOBE' },
      gradingConfig: { correctRegionId: null },
    });
    expect(result).toMatchObject({
      success: false,
      issues: [{ path: ['gradingConfig', 'correctRegionId'] }],
    });
  });

  it('normalizes a valid region ID and rejects malformed responses', () => {
    expect(
      validateAssignmentPublishPayload('MAP_REGION', 1, {
        publicConfig: { initialProjection: 'GLOBE' },
        gradingConfig: { correctRegionId: '  IND  ' },
      }),
    ).toEqual({
      success: true,
      data: {
        publicConfig: { initialProjection: 'GLOBE' },
        gradingConfig: { correctRegionId: 'IND' },
      },
    });
    expect(
      validateAssignmentStudentResponse('MAP_REGION', 1, {
        regionId: '  PRI  ',
      }),
    ).toEqual({ success: true, data: { regionId: 'PRI' } });
    expect(
      validateAssignmentStudentResponse('MAP_REGION', 1, {
        regionId: '',
        correctRegionId: 'IND',
      }),
    ).toMatchObject({ success: false });
  });
});
