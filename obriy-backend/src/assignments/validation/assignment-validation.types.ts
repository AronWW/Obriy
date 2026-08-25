import type { ZodType } from 'zod';

export type AssignmentValidationPathSegment = string | number;

export type AssignmentValidationIssueCode =
  | 'UNSUPPORTED_ASSIGNMENT_TYPE'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'INVALID_TYPE'
  | 'INVALID_VALUE'
  | 'INVALID_FORMAT'
  | 'TOO_SMALL'
  | 'TOO_BIG'
  | 'UNRECOGNIZED_KEY'
  | 'DUPLICATE_ID'
  | 'MIN_LENGTH_EXCEEDS_MAX_LENGTH'
  | 'TEXT_TOO_SHORT'
  | 'TEXT_TOO_LONG'
  | 'ATTACHMENTS_NOT_ALLOWED'
  | 'TOO_MANY_ATTACHMENTS'
  | 'FEATURE_UNAVAILABLE'
  | 'INVALID_CONFIGURATION';

export interface AssignmentValidationIssue {
  path: AssignmentValidationPathSegment[];
  code: AssignmentValidationIssueCode;
  message: string;
}

export type AssignmentValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: AssignmentValidationIssue[] };

export interface AssignmentValidationDefinition<
  TDraftPublicConfig = unknown,
  TPublishPublicConfig = unknown,
  TDraftSolution = unknown,
  TPublishSolution = unknown,
  TStudentResponse = unknown,
> {
  readonly type: string;
  readonly schemaVersion: number;
  readonly draftPublicConfigSchema: ZodType<TDraftPublicConfig>;
  readonly publishPublicConfigSchema: ZodType<TPublishPublicConfig>;
  readonly draftSolutionSchema: ZodType<TDraftSolution>;
  readonly publishSolutionSchema: ZodType<TPublishSolution>;
  readonly studentResponseSchema: ZodType<TStudentResponse>;
  createDefaultDraftPublicConfig(): TDraftPublicConfig;
  createDefaultSolution(): TDraftSolution;
  validateStudentResponseAgainstConfig?(
    response: TStudentResponse,
    publicConfig: TPublishPublicConfig,
  ): AssignmentValidationIssue[];
  validatePublishPayload?(
    publicConfig: TPublishPublicConfig,
    solution: TPublishSolution,
  ): AssignmentValidationIssue[];
}
