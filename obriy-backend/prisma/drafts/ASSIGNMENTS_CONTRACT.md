# Assignment content and test delivery contract

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
- An `Assignment` is reusable content and is never delivered directly.
  `TestItem` pins an exact `AssignmentRevision`; `TestRelease` then pins an
  exact `TestRevision`. Existing attempts therefore keep both the content and
  grading rules that the student actually received.
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

`gradingConfig`:
`{ "correctOptionIds": ["uuid"], "scoringMode": "ALL_OR_NOTHING" }`.

`responseData`: `{ "selectedOptionIds": ["uuid"] }`.

Score: `100%` for the correct option, otherwise `0%`. `TRUE/FALSE` is a
builder preset with two fixed options, not a separate database type.

### `MULTIPLE_CHOICE`

`publicConfig` contains `options: [{ id, text }]` and `shuffleOptions`.

`gradingConfig` contains `correctOptionIds` and teacher-selected `scoringMode`:
`ALL_OR_NOTHING` or `PARTIAL`.

`responseData`: `{ "selectedOptionIds": ["uuid"] }`.

Proposed score:

```text
max(0, correctSelected / totalCorrect - incorrectSelected / totalIncorrect) * 100
```

At least one distractor is required. Selecting every option therefore scores
zero instead of exploiting partial credit.

### `MATCHING`

`publicConfig` contains `leftItems: [{ id, text }]`,
`rightItems: [{ id, text }]`, and `shuffleRightItems`. The right column may
contain unused distractors. Its authored order is preserved unless shuffling
is enabled.

`gradingConfig` contains `matches: [{ leftItemId, rightItemId }]` and
`scoringMode: "PARTIAL | ALL_OR_NOTHING"`. Every left item has exactly one
match and every right item can be used by at most one match.

`responseData` uses the same `matches` shape and may be incomplete while being
saved as a draft. Submission requires every left item to be matched. Partial
score is the percentage of correctly matched left items; distractors do not
add extra penalties beyond making that left-side match incorrect.

### `ORDERING`

`publicConfig` contains `items: [{ id, text }]` in the teacher-authored order.
Student delivery always applies a deterministic shuffle and guarantees that
the initial order differs from the correct order.

`gradingConfig` contains `correctOrderIds` and
`scoringMode: "PARTIAL | ALL_OR_NOTHING"`.

`responseData`: `{ "orderedItemIds": ["uuid"] }`.

Partial score is the percentage of item pairs whose relative order is correct.
This rewards an almost-correct chronology more fairly than exact positions.

### `CATEGORIZATION`

`publicConfig` contains `categories: [{ id, title }]`,
`items: [{ id, text }]`. Student delivery always shuffles the items.

`gradingConfig` maps every `itemId` to exactly one `categoryId` and contains
`scoringMode: "PARTIAL | ALL_OR_NOTHING"`.

`responseData` contains the student's item-to-category mappings. Score is the
percentage of correctly categorized items.

### `FILL_BLANKS`

`publicConfig` contains ordered text/blank segments, opaque blank IDs, and an
optional word bank with distractors.

`gradingConfig` contains one or more accepted answers per blank and a scoring
mode. `responseData` maps blank IDs to submitted text. Comparison trims text,
collapses repeated whitespace, and ignores case.

Score is the percentage of correctly completed blanks. No fuzzy or AI grading
is used unless it is introduced as a separately approved feature.

### `IMAGE_HOTSPOT`

`publicConfig` references one Cloudinary-backed prompt attachment and its
intrinsic dimensions.

`gradingConfig` contains one normalized target point and a teacher-controlled
radius relative to the image's shorter side. The editor renders this radius
over the image; students never receive it. `responseData` contains one pair of
normalized coordinates so resizing the image does not alter the answer.

Every non-map assignment may optionally reference one prompt image. Uploads
are signed server-side Cloudinary uploads; only the attachment ID and intrinsic
dimensions enter `publicConfig`, never Cloudinary credentials.

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

## Test, release, and attempt rules

- `Test` is a reusable container; `TestRevision` pins ordered assignment
  revisions and their weights. A `LessonTest` pins the chosen test revision.
- Publishing a lesson creates one `TestRelease` per linked class and test.
- Test, assignment, and lesson content locales must match.
- `maxAttempts = null` means unlimited. A whole returned attempt is a
  correction cycle and does not consume the scored-attempt limit.
- `timeLimitSeconds` is enforced from server timestamps; the browser timer is
  informational only.
- `scorePolicy` selects the best or latest graded attempt for
  `TestStudentState`.
- Required lesson progress uses only active releases linked to that lesson.
- XP is awarded only once when the state first becomes `COMPLETED`; the future
  XP ledger must make this transaction idempotent.
- Review changes append `TestAnswerReviewEvent`; historical events are never
  updated in place.

## Invariants enforced by services

The database cannot express every cross-table rule. Backend transactions must
also verify:

- teacher ownership of the assignment, test, class, lesson, and custom map preset;
- assignment/revision type consistency with every JSON payload;
- assignment and lesson locale equality;
- student membership in the release class;
- linked lesson test existence for lesson releases;
- immutable published revisions and immutable submitted attempts;
- lesson links can move to a new test revision only when no active attempt
  exists; historical releases and attempts keep their pinned revisions;
- attachment MIME type, size, ownership, scan status, and parent consistency;
- idempotent attempt creation and XP/review transitions.

## Delivery and legacy cutover

- Map assignments are delivered as a separate design and implementation block;
  the generic authoring API must not expose them before their geography,
  interaction, and grading contracts are approved.
- The legacy lesson-task and direct assignment-delivery tables have been
  removed by new forward migrations; historical migration files remain
  unchanged.
- Lesson progress uses required active `TestRelease` rows and their
  `TestStudentState` only. Assignment content is never counted independently.
