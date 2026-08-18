export type AssignmentType =
  | 'WRITTEN'
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'MATCHING'
  | 'ORDERING'
  | 'CATEGORIZATION'
  | 'FILL_BLANKS'
  | 'IMAGE_HOTSPOT'
  | 'MAP_POINT'
  | 'MAP_REGION'
  | 'MAP_MULTI_REGION'

export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type AssignmentRevisionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type ContentLocale = 'UK' | 'EN'
export type AssignmentRevisionSource = 'DRAFT' | 'PUBLISHED'

export interface AssignmentRubricItem {
  id: string
  title: string
  description: string
  weight: number
}

export interface WrittenPublicConfig {
  responseMode: 'SHORT' | 'LONG'
  minLength: number
  maxLength: number
  allowAttachments: boolean
  rubric: AssignmentRubricItem[]
}

export interface ChoiceOption {
  id: string
  text: string
}

export interface ChoicePublicConfig {
  options: ChoiceOption[]
  shuffleOptions: boolean
}

export interface ChoiceGradingConfig {
  correctOptionIds: string[]
  scoringMode: 'ALL_OR_NOTHING' | 'PARTIAL'
}

export interface AssignmentRevisionSummary {
  id: string
  version: number
  status: AssignmentRevisionStatus
  title: string
  editVersion: number
  publishedAt: string | null
  updatedAt: string
}

export interface AssignmentSummary {
  id: string
  type: AssignmentType
  contentLocale: ContentLocale
  status: AssignmentStatus
  defaultMaxPoints: number
  defaultPassingPercent: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  draftRevision: AssignmentRevisionSummary | null
  publishedRevision: AssignmentRevisionSummary | null
}

export interface AssignmentEditorRevision {
  id: string
  version: number
  status: AssignmentRevisionStatus
  title: string
  prompt: string
  instructions: string | null
  explanation: string | null
  publicConfig: Record<string, unknown>
  gradingConfig: Record<string, unknown> | null
  mapPresetId: string | null
  schemaVersion: number
  editVersion: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AssignmentEditor {
  id: string
  type: AssignmentType
  contentLocale: ContentLocale
  status: AssignmentStatus
  defaultMaxPoints: number
  defaultPassingPercent: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  draftRevision: AssignmentEditorRevision | null
  publishedRevision: AssignmentEditorRevision | null
}

export interface AssignmentListResponse {
  items: AssignmentSummary[]
  nextCursor: string | null
}

export interface AssignmentFilters {
  search?: string
  status?: AssignmentStatus
  type?: AssignmentType
  contentLocale?: ContentLocale
}

export interface AssignmentDraftInput {
  title: string
  prompt: string
  instructions: string | null
  explanation: string | null
  publicConfig: WrittenPublicConfig | ChoicePublicConfig
  gradingConfig: { mode: 'MANUAL' } | ChoiceGradingConfig
}

export interface WrittenAssignmentDraftInput extends AssignmentDraftInput {
  publicConfig: WrittenPublicConfig
  gradingConfig: { mode: 'MANUAL' }
}

export interface CreateAssignmentInput {
  type: AssignmentType
  defaultMaxPoints: number
  defaultPassingPercent: number
  draft: AssignmentDraftInput
}

export interface UpdateAssignmentDraftInput extends AssignmentDraftInput {
  expectedRevisionId: string
  expectedEditVersion: number
  defaultMaxPoints: number
  defaultPassingPercent: number
}
