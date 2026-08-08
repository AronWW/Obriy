# AssignmentsModule data contract (draft)

This document defines the JSON stored by the initial Prisma schema. Runtime
validation must use a discriminated schema selected by `Assignment.type` and
`AssignmentRevision.schemaVersion`.

## Shared rules

- `Assignment.type` and `contentLocale` are immutable after creation.
- Every option/item/pair/blank uses a stable opaque UUID. Answers never depend
  on labels or array positions.
- `AssignmentRevision.publicConfig` is safe for students.
- `AssignmentSolution.gradingConfig` is private and must never be selected by a
  student query, returned in an error, or written to application logs.
- A draft revision may be incomplete. Publishing performs strict validation and
  makes the revision immutable.
- At most one `DRAFT` and one current `PUBLISHED` revision may exist for an
  assignment. Older used revisions become `ARCHIVED`, not deleted.
- `AssignmentRelease` pins an exact revision. Existing attempts therefore keep
  the content and grading rules that the student actually received.
- `responseData`, `gradingData`, and `feedbackData` have explicit size limits in
  the API; arbitrary client JSON is rejected.
- Scores are stored as a percentage from `0` to `100` and points are calculated
  as `round(maxPoints * scorePercent / 100, 2)`.

## Type payloads

### `WRITTEN`

`publicConfig`:

```json
{
  "responseMode": "SHORT | LONG",
  "minLength": 0,
  "maxLength": 20000,
  "allowAttachments": true,
  "rubric": [
    { "id": "uuid", "title": "...", "description": "...", "weight": 1 }
  ]
}
```

`gradingConfig`: `{ "mode": "MANUAL" }`.

`responseData`: `{ "text": "...", "attachmentIds": ["uuid"] }`.

The teacher grades the rubric and may approve or return the attempt.

### `SINGLE_CHOICE`

`publicConfig` contains `options: [{ id, text }]` and `shuffleOptions`.

`gradingConfig`: `{ "correctOptionId": "uuid" }`.

`responseData`: `{ "optionId": "uuid" }`.

Score: `100%` for the correct option, otherwise `0%`. `TRUE/FALSE` is a
builder preset with two fixed options, not a separate database type.

### `MULTIPLE_CHOICE`

`publicConfig` contains `options: [{ id, text }]`, `shuffleOptions`,
`minSelections`, and `maxSelections`.

`gradingConfig`: `{ "correctOptionIds": ["uuid"] }`.

`responseData`: `{ "optionIds": ["uuid"] }`.

Proposed score:

```text
max(0, (correctSelected - incorrectSelected) / totalCorrect) * 100
```

This gives `75%` for three correct choices out of four and prevents selecting
every option from producing a full score.

### `MATCHING`

`publicConfig` contains `leftItems: [{ id, text }]`,
`rightItems: [{ id, text }]`, and shuffle settings.

`gradingConfig`: `{ "pairs": [{ "leftId": "uuid", "rightId": "uuid" }] }`.

`responseData` uses the same pair shape. Score is the percentage of correctly
matched left items.

### `ORDERING`

`publicConfig` contains `items: [{ id, text }]` and shuffle settings.

`gradingConfig`: `{ "orderedItemIds": ["uuid"] }`.

`responseData`: `{ "orderedItemIds": ["uuid"] }`.

Partial score is the percentage of item pairs whose relative order is correct.
This rewards an almost-correct chronology more fairly than exact positions.

### `CATEGORIZATION`

`publicConfig` contains `categories: [{ id, title }]`,
`items: [{ id, text }]`, and shuffle settings.

`gradingConfig` maps every `itemId` to one `categoryId`.

`responseData` contains the student's item-to-category mappings. Score is the
percentage of correctly categorized items.

### `FILL_BLANKS`

`publicConfig` contains ordered text segments, opaque blank IDs, an optional
word bank, and case/whitespace display settings.

`gradingConfig` contains accepted answers per blank and explicit normalization
rules. `responseData` maps blank IDs to submitted text or word-bank item IDs.

Score is the percentage of correctly completed blanks. No fuzzy or AI grading
is used unless it is introduced as a separately approved feature.

### `IMAGE_HOTSPOT`

`publicConfig` references a prompt attachment, its intrinsic dimensions, and
the allowed number of selections.

`gradingConfig` contains normalized hotspot shapes or points and their scoring
tolerances. `responseData` contains normalized student coordinates so resizing
the image does not alter the answer.

### `MAP_POINT`

`AssignmentRevision.mapPresetId` selects the map. `publicConfig` contains the
initial viewport and visible layers.

`gradingConfig` contains the correct longitude/latitude, full-score radius, and
optional partial-score distance bands.

`responseData`: `{ "lng": 0, "lat": 0 }`. Distance is calculated only on the
server.

### `MAP_REGION` and `MAP_MULTI_REGION`

`publicConfig` contains selection limits and rendering settings for the linked
map preset.

`gradingConfig` contains the correct opaque GeoJSON feature IDs.

`responseData`: `{ "featureIds": ["..."] }`. Score uses the same penalized-set
rule as multiple choice. Polygon versus multipolygon remains an internal map
detail, not a separate teacher-facing type.

## Release and attempt rules

- One bulk teacher action creates one `AssignmentRelease` per selected class.
- `lessonId` is optional. When present, the service verifies an existing
  `LessonAssignment`, matching teacher ownership, revision, and content locale.
- `maxAttempts = null` means unlimited. Written work can be resubmitted only
  after the teacher returns it.
- `timeLimitSeconds` is enforced from server timestamps; the browser timer is
  informational only.
- `scorePolicy` selects the best or latest graded attempt for
  `AssignmentStudentState`.
- Required lesson progress uses only active releases linked to that lesson.
- XP is awarded only once when the state first becomes `COMPLETED`; the future
  XP ledger must make this transaction idempotent.
- Review changes append `AssignmentReviewEvent`; historical events are never
  updated in place.

## Invariants enforced by services

The database cannot express every cross-table rule. Backend transactions must
also verify:

- teacher ownership of the assignment, class, lesson, and custom map preset;
- assignment/revision type consistency with every JSON payload;
- assignment and lesson locale equality;
- student membership in the release class;
- linked lesson assignment existence for lesson releases;
- immutable published revisions and immutable submitted attempts;
- revision changes only for releases without attempts; otherwise the old
  release is closed and a new release is created;
- attachment MIME type, size, ownership, scan status, and parent consistency;
- idempotent attempt creation and XP/review transitions.

## Delivery and legacy cutover

- Map assignments are delivered as a separate design and implementation block;
  the generic authoring API must not expose them before their geography,
  interaction, and grading contracts are approved.
- The legacy `LessonTask` and `LessonTaskSubmission` module is temporary and
  will be removed completely rather than migrated into the new model.
- Legacy reads, writes, lesson progress calculations, frontend calls, and tests
  stay available until the new release/attempt/review flow replaces them
  end-to-end. The two systems are never combined when calculating progress.
- Application code must stop accessing the legacy tables before they are
  dropped. The destructive drop remains a separate reviewed migration and is
  applied only after explicit approval; the historical migration that created
  the legacy tables remains unchanged.
