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

export interface AssignmentPromptImage {
  attachmentId: string
  width: number
  height: number
}

export interface WrittenPublicConfig {
  responseMode: 'SHORT' | 'LONG'
  minLength: number
  maxLength: number
  allowAttachments: boolean
  rubric: AssignmentRubricItem[]
  promptImage?: AssignmentPromptImage | null
}

export interface ChoiceOption {
  id: string
  text: string
}

export interface ChoicePublicConfig {
  options: ChoiceOption[]
  shuffleOptions: boolean
  promptImage?: AssignmentPromptImage | null
}

export interface ChoiceGradingConfig {
  correctOptionIds: string[]
  scoringMode: 'ALL_OR_NOTHING' | 'PARTIAL'
}

export interface MatchingItem {
  id: string
  text: string
}

export interface MatchingPair {
  leftItemId: string
  rightItemId: string
}

export interface MatchingPublicConfig {
  leftItems: MatchingItem[]
  rightItems: MatchingItem[]
  shuffleRightItems: boolean
  promptImage?: AssignmentPromptImage | null
}

export interface MatchingGradingConfig {
  matches: MatchingPair[]
  scoringMode: 'ALL_OR_NOTHING' | 'PARTIAL'
}

export interface OrderingItem {
  id: string
  text: string
}

export interface OrderingPublicConfig {
  items: OrderingItem[]
  promptImage?: AssignmentPromptImage | null
}

export interface OrderingGradingConfig {
  correctOrderIds: string[]
  scoringMode: 'ALL_OR_NOTHING' | 'PARTIAL'
}

export interface CategorizationPublicConfig {
  categories: Array<{ id: string; title: string }>
  items: Array<{ id: string; text: string }>
  promptImage?: AssignmentPromptImage | null
}

export interface CategorizationGradingConfig {
  assignments: Array<{ itemId: string; categoryId: string }>
  scoringMode: 'ALL_OR_NOTHING' | 'PARTIAL'
}

export type FillBlanksSegment =
  { id: string; type: 'TEXT'; text: string } | { id: string; type: 'BLANK' }

export interface FillBlanksPublicConfig {
  segments: FillBlanksSegment[]
  wordBankEnabled: boolean
  wordBank: Array<{ id: string; text: string }>
  promptImage?: AssignmentPromptImage | null
}

export interface FillBlanksGradingConfig {
  blanks: Array<{ blankId: string; acceptedAnswers: string[] }>
  scoringMode: 'ALL_OR_NOTHING' | 'PARTIAL'
}

export interface ImageHotspotPublicConfig {
  promptImage: AssignmentPromptImage | null
}

export interface ImageHotspotGradingConfig {
  target: { x: number; y: number; radius: number }
}

export interface MapPointPublicConfig {
  initialProjection: 'MERCATOR' | 'GLOBE'
}

export interface AssignmentMapPoint {
  longitude: number
  latitude: number
}

export interface MapPointGradingConfig {
  target: AssignmentMapPoint | null
  radiusKm: number
}

export interface MapRegionPublicConfig {
  initialProjection: 'MERCATOR' | 'GLOBE'
}

export interface MapRegionGradingConfig {
  correctRegionId: string | null
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
  publicConfig:
    | WrittenPublicConfig
    | ChoicePublicConfig
    | MatchingPublicConfig
    | OrderingPublicConfig
    | CategorizationPublicConfig
    | FillBlanksPublicConfig
    | ImageHotspotPublicConfig
    | MapPointPublicConfig
    | MapRegionPublicConfig
  gradingConfig:
    | { mode: 'MANUAL' }
    | ChoiceGradingConfig
    | MatchingGradingConfig
    | OrderingGradingConfig
    | CategorizationGradingConfig
    | FillBlanksGradingConfig
    | ImageHotspotGradingConfig
    | MapPointGradingConfig
    | MapRegionGradingConfig
  mapPresetId?: string | null
}

export interface WrittenAssignmentDraftInput extends AssignmentDraftInput {
  publicConfig: WrittenPublicConfig
  gradingConfig: { mode: 'MANUAL' }
}

export interface MatchingAssignmentDraftInput extends AssignmentDraftInput {
  publicConfig: MatchingPublicConfig
  gradingConfig: MatchingGradingConfig
}

export interface OrderingAssignmentDraftInput extends AssignmentDraftInput {
  publicConfig: OrderingPublicConfig
  gradingConfig: OrderingGradingConfig
}

export interface CategorizationAssignmentDraftInput extends AssignmentDraftInput {
  publicConfig: CategorizationPublicConfig
  gradingConfig: CategorizationGradingConfig
}

export interface FillBlanksAssignmentDraftInput extends AssignmentDraftInput {
  publicConfig: FillBlanksPublicConfig
  gradingConfig: FillBlanksGradingConfig
}

export interface ImageHotspotAssignmentDraftInput extends AssignmentDraftInput {
  publicConfig: ImageHotspotPublicConfig
  gradingConfig: ImageHotspotGradingConfig
}

export interface MapPointAssignmentDraftInput extends AssignmentDraftInput {
  publicConfig: MapPointPublicConfig
  gradingConfig: MapPointGradingConfig
  mapPresetId: string | null
}

export interface MapRegionAssignmentDraftInput extends AssignmentDraftInput {
  publicConfig: MapRegionPublicConfig
  gradingConfig: MapRegionGradingConfig
  mapPresetId: string | null
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
