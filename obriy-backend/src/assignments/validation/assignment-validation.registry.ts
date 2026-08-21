import { z, type ZodError } from 'zod';

import type {
  AssignmentValidationDefinition,
  AssignmentValidationIssue,
  AssignmentValidationIssueCode,
  AssignmentValidationPathSegment,
  AssignmentValidationResult,
} from './assignment-validation.types';
import {
  WRITTEN_SCHEMA_VERSION,
  writtenAssignmentValidationDefinition,
} from './written-assignment.schemas';
import {
  CHOICE_SCHEMA_VERSION,
  multipleChoiceAssignmentValidationDefinition,
  singleChoiceAssignmentValidationDefinition,
} from './choice-assignment.schemas';
import {
  MATCHING_SCHEMA_VERSION,
  matchingAssignmentValidationDefinition,
} from './matching-assignment.schemas';
import {
  ORDERING_SCHEMA_VERSION,
  orderingAssignmentValidationDefinition,
} from './ordering-assignment.schemas';
import {
  CATEGORIZATION_SCHEMA_VERSION,
  categorizationAssignmentValidationDefinition,
} from './categorization-assignment.schemas';
import {
  FILL_BLANKS_SCHEMA_VERSION,
  fillBlanksAssignmentValidationDefinition,
} from './fill-blanks-assignment.schemas';
import {
  IMAGE_HOTSPOT_SCHEMA_VERSION,
  imageHotspotAssignmentValidationDefinition,
} from './image-hotspot-assignment.schemas';

type UnknownAssignmentValidationDefinition = AssignmentValidationDefinition<
  unknown,
  unknown,
  unknown,
  unknown,
  unknown
>;

const assignmentValidationRegistry: Readonly<
  Record<
    string,
    Readonly<Record<number, UnknownAssignmentValidationDefinition>>
  >
> = Object.freeze({
  WRITTEN: Object.freeze({
    [WRITTEN_SCHEMA_VERSION]: writtenAssignmentValidationDefinition,
  }),
  SINGLE_CHOICE: Object.freeze({
    [CHOICE_SCHEMA_VERSION]: singleChoiceAssignmentValidationDefinition,
  }),
  MULTIPLE_CHOICE: Object.freeze({
    [CHOICE_SCHEMA_VERSION]: multipleChoiceAssignmentValidationDefinition,
  }),
  MATCHING: Object.freeze({
    [MATCHING_SCHEMA_VERSION]: matchingAssignmentValidationDefinition,
  }),
  ORDERING: Object.freeze({
    [ORDERING_SCHEMA_VERSION]: orderingAssignmentValidationDefinition,
  }),
  CATEGORIZATION: Object.freeze({
    [CATEGORIZATION_SCHEMA_VERSION]:
      categorizationAssignmentValidationDefinition,
  }),
  FILL_BLANKS: Object.freeze({
    [FILL_BLANKS_SCHEMA_VERSION]: fillBlanksAssignmentValidationDefinition,
  }),
  IMAGE_HOTSPOT: Object.freeze({
    [IMAGE_HOTSPOT_SCHEMA_VERSION]: imageHotspotAssignmentValidationDefinition,
  }),
});

export interface AssignmentPublishValidationPayload {
  publicConfig: unknown;
  gradingConfig: unknown;
}

export function resolveAssignmentValidationDefinition(
  type: string,
  schemaVersion: number,
): AssignmentValidationResult<UnknownAssignmentValidationDefinition> {
  const versions = assignmentValidationRegistry[type];

  if (!versions) {
    return validationFailure({
      path: ['type'],
      code: 'UNSUPPORTED_ASSIGNMENT_TYPE',
      message: 'Assignment type is not supported.',
    });
  }

  const definition = versions[schemaVersion];
  if (!definition) {
    return validationFailure({
      path: ['schemaVersion'],
      code: 'UNSUPPORTED_SCHEMA_VERSION',
      message: 'Assignment schema version is not supported.',
    });
  }

  return { success: true, data: definition };
}

export function createAssignmentValidationDefaults(
  type: string,
  schemaVersion: number,
): AssignmentValidationResult<{
  publicConfig: unknown;
  gradingConfig: unknown;
}> {
  const resolved = resolveAssignmentValidationDefinition(type, schemaVersion);
  if (!resolved.success) {
    return resolved;
  }

  return {
    success: true,
    data: {
      publicConfig: resolved.data.createDefaultDraftPublicConfig(),
      gradingConfig: resolved.data.createDefaultSolution(),
    },
  };
}

export function validateAssignmentDraftPublicConfig(
  type: string,
  schemaVersion: number,
  publicConfig: unknown,
): AssignmentValidationResult<unknown> {
  const resolved = resolveAssignmentValidationDefinition(type, schemaVersion);
  if (!resolved.success) {
    return resolved;
  }

  return parseSchema(resolved.data.draftPublicConfigSchema, publicConfig);
}

export function validateAssignmentSolution(
  type: string,
  schemaVersion: number,
  gradingConfig: unknown,
): AssignmentValidationResult<unknown> {
  const resolved = resolveAssignmentValidationDefinition(type, schemaVersion);
  if (!resolved.success) {
    return resolved;
  }

  return parseSchema(resolved.data.draftSolutionSchema, gradingConfig);
}

export function validateAssignmentPublishPayload(
  type: string,
  schemaVersion: number,
  payload: AssignmentPublishValidationPayload,
): AssignmentValidationResult<AssignmentPublishValidationPayload> {
  const resolved = resolveAssignmentValidationDefinition(type, schemaVersion);
  if (!resolved.success) {
    return resolved;
  }

  const publishSchema = z
    .object({
      publicConfig: resolved.data.publishPublicConfigSchema,
      gradingConfig: resolved.data.publishSolutionSchema,
    })
    .strict();

  const result = parseSchema(publishSchema, payload);
  if (!result.success) {
    return result;
  }

  const contextualIssues =
    resolved.data.validatePublishPayload?.(
      result.data.publicConfig,
      result.data.gradingConfig,
    ) ?? [];

  return contextualIssues.length > 0
    ? { success: false, issues: contextualIssues }
    : result;
}

export function validateAssignmentStudentResponse(
  type: string,
  schemaVersion: number,
  responseData: unknown,
  publicConfig?: unknown,
): AssignmentValidationResult<unknown> {
  const resolved = resolveAssignmentValidationDefinition(type, schemaVersion);
  if (!resolved.success) {
    return resolved;
  }

  const responseResult = parseSchema(
    resolved.data.studentResponseSchema,
    responseData,
  );
  if (!responseResult.success || publicConfig === undefined) {
    return responseResult;
  }

  const configResult = parseSchema(
    resolved.data.publishPublicConfigSchema,
    publicConfig,
  );
  if (!configResult.success) {
    return validationFailure({
      path: [],
      code: 'INVALID_CONFIGURATION',
      message: 'Assignment configuration is invalid.',
    });
  }

  const contextualIssues =
    resolved.data.validateStudentResponseAgainstConfig?.(
      responseResult.data,
      configResult.data,
    ) ?? [];

  if (contextualIssues.length > 0) {
    return { success: false, issues: contextualIssues };
  }

  return responseResult;
}

export function normalizeAssignmentValidationIssues(
  error: ZodError,
): AssignmentValidationIssue[] {
  return error.issues.map((issue) => {
    const customCode = getSafeCustomCode(issue);
    const code = customCode ?? normalizeZodIssueCode(issue.code);

    return {
      path: issue.path.map(normalizePathSegment),
      code,
      message: issueMessage(code),
    };
  });
}

function parseSchema<T>(
  schema: z.ZodType<T>,
  input: unknown,
): AssignmentValidationResult<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      issues: normalizeAssignmentValidationIssues(result.error),
    };
  }

  return { success: true, data: result.data };
}

function validationFailure<T = never>(
  issue: AssignmentValidationIssue,
): AssignmentValidationResult<T> {
  return { success: false, issues: [issue] };
}

function normalizePathSegment(
  segment: PropertyKey,
): AssignmentValidationPathSegment {
  return typeof segment === 'symbol' ? String(segment) : segment;
}

function getSafeCustomCode(
  issue: ZodError['issues'][number],
): AssignmentValidationIssueCode | undefined {
  if (issue.code !== 'custom') {
    return undefined;
  }

  if (
    issue.message === 'DUPLICATE_ID' ||
    issue.message === 'MIN_LENGTH_EXCEEDS_MAX_LENGTH' ||
    issue.message === 'INVALID_CONFIGURATION'
  ) {
    return issue.message;
  }

  return undefined;
}

function normalizeZodIssueCode(
  code: ZodError['issues'][number]['code'],
): AssignmentValidationIssueCode {
  switch (code) {
    case 'invalid_type':
      return 'INVALID_TYPE';
    case 'invalid_value':
      return 'INVALID_VALUE';
    case 'invalid_format':
      return 'INVALID_FORMAT';
    case 'too_small':
      return 'TOO_SMALL';
    case 'too_big':
      return 'TOO_BIG';
    case 'unrecognized_keys':
      return 'UNRECOGNIZED_KEY';
    default:
      return 'INVALID_VALUE';
  }
}

function issueMessage(code: AssignmentValidationIssueCode): string {
  switch (code) {
    case 'DUPLICATE_ID':
      return 'Identifier must be unique.';
    case 'MIN_LENGTH_EXCEEDS_MAX_LENGTH':
      return 'Minimum length cannot exceed maximum length.';
    case 'UNRECOGNIZED_KEY':
      return 'Object contains an unsupported property.';
    case 'TOO_SMALL':
      return 'Value is below the allowed minimum.';
    case 'TOO_BIG':
      return 'Value exceeds the allowed maximum.';
    case 'INVALID_FORMAT':
      return 'Value has an invalid format.';
    case 'INVALID_TYPE':
      return 'Value has an invalid type.';
    case 'INVALID_CONFIGURATION':
      return 'Assignment configuration is invalid.';
    default:
      return 'Value is invalid.';
  }
}
