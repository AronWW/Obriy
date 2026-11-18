import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 1000, theme: 'day' },
  { name: 'mobile', width: 390, height: 844, theme: 'night' },
] as const

for (const viewport of viewports) {
  test(`MAP_MULTI_REGION teacher editor works in 2D and globe on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareSession(page, 'TEACHER', viewport.theme)
    await mockMaps(page, viewport.theme)

    await page.goto('/app/teacher/tasks/new/map_multi_region')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page
      .getByRole('combobox', { name: 'Geographic dataset' })
      .selectOption('preset-world')
    const map = page.getByRole('region', {
      name: 'Correct map regions editor',
    })
    await expect(map.locator('canvas.maplibregl-canvas')).toBeVisible()
    await page.getByRole('checkbox', { name: /India/ }).check()
    await page.getByRole('checkbox', { name: /France/ }).check()
    await expect(page.getByText('2 of 50')).toBeVisible()
    await page.getByRole('radio', { name: 'Globe' }).check()
    await expect(page.getByRole('radio', { name: 'Globe' })).toBeChecked()
    await expectNoHorizontalOverflow(page)

    await page.screenshot({
      path: testInfo.outputPath(`map-multi-teacher-${viewport.name}.png`),
      fullPage: true,
    })
  })

  test(`MAP_MULTI_REGION student runner enforces its limit on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareSession(page, 'STUDENT', viewport.theme)
    await mockMaps(page, viewport.theme)
    await mockStudentLesson(page)

    await page.goto('/app/student/lessons/lesson-multi-region')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Start' }).click()
    const dialog = page.getByRole('dialog', { name: 'Countries check' })
    await dialog.getByRole('button', { name: 'Start' }).click()
    const map = dialog.getByRole('region', {
      name: 'Map for selecting multiple regions',
    })
    await expect(map.locator('canvas.maplibregl-canvas')).toBeVisible()
    await dialog.getByRole('checkbox', { name: /India/ }).check()
    await dialog.getByRole('checkbox', { name: /France/ }).check()
    await expect(dialog.getByText('2 of 2')).toBeVisible()
    await expect(dialog.getByRole('checkbox', { name: /Germany/ })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Globe' }).click()
    await expect(dialog.getByRole('button', { name: 'Globe' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await dialog.getByRole('button', { name: 'Finish test' }).click()
    await page
      .getByRole('dialog', { name: 'Finish this attempt?' })
      .getByRole('button', { name: 'Submit answers' })
      .click()
    await expect(
      dialog.getByText('Correct regions and your answer'),
    ).toBeVisible()
    await expect(
      dialog.getByText('Correct selections: 2 of 2 · extra: 0'),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.screenshot({
      path: testInfo.outputPath(`map-multi-student-${viewport.name}.png`),
      fullPage: true,
    })
  })
}

async function prepareSession(
  page: Page,
  role: 'TEACHER' | 'STUDENT',
  theme: 'day' | 'night',
) {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('obriy-night-default-v1', 'done')
    localStorage.setItem('obriy-theme', selectedTheme)
    localStorage.setItem('obriy-language', 'en')
    localStorage.setItem('obriy-has-session', '1')
  }, theme)
  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: `map-multi-${role.toLowerCase()}-token`,
        user: {
          id: `map-multi-${role.toLowerCase()}`,
          email: `${role.toLowerCase()}@example.com`,
          role,
          status: 'ACTIVE',
          emailVerifiedAt: '2026-09-05T10:00:00.000Z',
          hasPassword: true,
          profile: {
            displayName: role === 'TEACHER' ? 'Map Teacher' : 'Map Student',
            avatarUrl: null,
            bio: null,
            subjectArea: role === 'TEACHER' ? 'Geography' : null,
            preferredLocale: 'EN',
          },
        },
      }),
    })
  })
}

async function mockMaps(page: Page, theme: 'day' | 'night') {
  await page.route('**/map-presets', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([mapPreset()]),
    })
  })
  await page.route('**/maps/world-adm0.geojson', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/geo+json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [
          feature('IND', 'India', 'Індія', 68, 8, 97, 35),
          feature('FRA', 'France', 'Франція', -5, 42, 8, 51),
          feature('DEU', 'Germany', 'Німеччина', 5, 47, 16, 55),
        ],
      }),
    })
  })
  await page.route('https://tiles.openfreemap.org/styles/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        name: 'MAP_MULTI_REGION smoke style',
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': theme === 'night' ? '#172029' : '#e8ece9',
            },
          },
        ],
      }),
    })
  })
}

async function mockStudentLesson(page: Page) {
  let started = false
  let submitted = false
  let responseData: Record<string, unknown> = { selectedRegionIds: [] }
  const attempt = () => ({
    id: 'attempt-multi-region',
    attemptNumber: 1,
    status: submitted ? 'GRADED' : 'IN_PROGRESS',
    maxPoints: 6,
    scorePoints: submitted ? 6 : null,
    scorePercent: submitted ? 100 : null,
    isPassed: submitted ? true : null,
    pendingReviewCount: 0,
    answers: [
      {
        id: 'answer-multi-region',
        testItemId: 'item-multi-region',
        status: submitted ? 'GRADED' : 'DRAFT',
        responseData,
        maxPoints: 6,
        scorePoints: submitted ? 6 : null,
        scorePercent: submitted ? 100 : null,
        isCorrect: submitted ? true : null,
        teacherComment: null,
        solutionFeedback: submitted
          ? {
              correctRegionIds: ['IND', 'FRA'],
              correctSelectedCount: 2,
              incorrectSelectedCount: 0,
              expectedCorrectCount: 2,
              creditFraction: 1,
              scoringMode: 'PARTIAL',
            }
          : null,
      },
    ],
    startedAt: '2026-09-05T10:00:00.000Z',
    expiresAt: null,
    submittedAt: submitted ? '2026-09-05T10:05:00.000Z' : null,
    gradedAt: submitted ? '2026-09-05T10:05:00.000Z' : null,
  })
  const release = (includeItems: boolean) => ({
    releaseId: 'release-multi-region',
    testId: 'test-multi-region',
    testRevisionId: 'test-revision-multi-region',
    title: 'Countries check',
    description: 'Choose both requested countries.',
    instructions: null,
    maxPoints: 6,
    passingPercent: 60,
    isRequired: true,
    maxAttempts: 1,
    timeLimitSeconds: null,
    dueAt: null,
    stateStatus: submitted ? 'COMPLETED' : started ? 'IN_PROGRESS' : 'NOT_STARTED',
    itemCount: 1,
    items: includeItems
      ? [
          {
            id: 'item-multi-region',
            position: 0,
            maxPoints: 6,
            assignmentId: 'assignment-multi-region',
            assignmentRevisionId: 'revision-multi-region',
            type: 'MAP_MULTI_REGION',
            title: 'Find India and France',
            prompt: 'Choose India and France on the map.',
            instructions: null,
            publicConfig: {
              initialProjection: 'MERCATOR',
              requiredSelectionCount: 2,
            },
            mapPreset: mapPreset(),
          },
        ]
      : [],
    attempt: started ? attempt() : null,
  })

  await page.route(
    '**/classes/me/lessons/lesson-multi-region',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'lesson-multi-region',
          title: 'Multiple-region lesson',
          summary: 'Practice selecting countries.',
          content: 'Use the map to answer the question.',
          contentLocale: 'EN',
          estimatedMinutes: 10,
          position: 0,
          class: { id: 'class-multi-region', name: 'Geography club' },
          teacher: { id: 'teacher-multi-region', displayName: 'Map Teacher' },
          progress: {
            status: 'NOT_STARTED',
            requiredTotal: 1,
            completed: 0,
            awaitingReview: 0,
            needsRevision: 0,
            inProgress: 0,
            expired: 0,
          },
        }),
      })
    },
  )
  await page.route(
    '**/classes/me/lessons/lesson-multi-region/assignments',
    async (route) => route.fulfill({ status: 200, body: '[]' }),
  )
  await page.route(
    '**/classes/me/lessons/lesson-multi-region/tests',
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([release(started)]),
      }),
  )
  await page.route('**/test-releases/release-multi-region', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(release(started)),
    })
  })
  await page.route(
    '**/test-releases/release-multi-region/attempts',
    async (route) => {
      started = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(attempt()),
      })
    },
  )
  await page.route(
    '**/test-attempts/attempt-multi-region/answers/item-multi-region',
    async (route) => {
      const body = (await route.request().postDataJSON()) as {
        responseData?: Record<string, unknown>
      }
      responseData = body.responseData ?? responseData
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(attempt()),
      })
    },
  )
  await page.route(
    '**/test-attempts/attempt-multi-region/submit',
    async (route) => {
      submitted = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(attempt()),
      })
    },
  )
}

function mapPreset() {
  return {
    id: 'preset-world',
    key: 'world-adm0',
    name: 'World countries',
    contentLocale: 'EN',
    sourceType: 'BUILT_IN',
    geojsonUrl: '/maps/world-adm0.geojson',
    idProperty: 'featureId',
    year: 2025,
    attribution: 'geoBoundaries ADM0 · ODbL 1.0',
    bounds: { west: -180, south: -85, east: 180, north: 85 },
    defaultViewport: { longitude: 15, latitude: 20, zoom: 1.25 },
  }
}

function feature(
  id: string,
  name: string,
  nameUk: string,
  west: number,
  south: number,
  east: number,
  north: number,
) {
  return {
    type: 'Feature',
    properties: { featureId: id, shapeISO: id, name, nameEn: name, nameUk },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
}
