import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 1000, theme: 'day' },
  { name: 'mobile', width: 390, height: 844, theme: 'night' },
] as const

for (const viewport of viewports) {
  test(`MAP_REGION teacher editor renders in 2D and globe on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareSession(page, 'TEACHER', viewport.theme)
    await mockMapCatalog(page)
    await mockGeoJson(page)
    await mockOpenFreeMapStyle(page, viewport.theme)

    await page.goto('/app/teacher/tasks/new/map_region')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page
      .getByRole('combobox', { name: 'Geographic dataset' })
      .selectOption('preset-world')

    const mapRegion = page.getByRole('region', {
      name: 'Correct map region editor',
    })
    await expect(mapRegion.locator('canvas.maplibregl-canvas')).toBeVisible()
    await page
      .getByRole('combobox', { name: 'Region list' })
      .selectOption('IND')
    await expect(page.getByText('India', { exact: true })).toBeVisible()
    await page.getByRole('radio', { name: 'Globe' }).check()
    await expect(page.getByRole('radio', { name: 'Globe' })).toBeChecked()
    await expectNoHorizontalOverflow(page)

    await page.screenshot({
      path: testInfo.outputPath(`map-region-teacher-${viewport.name}.png`),
      fullPage: true,
    })
  })

  test(`MAP_REGION student runner renders in 2D and globe on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareSession(page, 'STUDENT', viewport.theme)
    await mockStudentLesson(page)
    await mockGeoJson(page)
    await mockOpenFreeMapStyle(page, viewport.theme)

    await page.goto('/app/student/lessons/lesson-region')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Start' }).click()
    const dialog = page.getByRole('dialog', { name: 'Country check' })
    await dialog.getByRole('button', { name: 'Start' }).click()

    const mapRegion = dialog.getByRole('region', {
      name: 'Map for the student region selection',
    })
    await expect(mapRegion.locator('canvas.maplibregl-canvas')).toBeVisible()
    await dialog
      .getByRole('combobox', { name: 'Region list' })
      .selectOption('PRI')
    await expect(dialog.getByText('Puerto Rico', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Globe' }).click()
    await expect(dialog.getByRole('button', { name: 'Globe' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expectNoHorizontalOverflow(page)

    await page.screenshot({
      path: testInfo.outputPath(`map-region-student-${viewport.name}.png`),
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
    localStorage.setItem('obriy-theme', selectedTheme)
    localStorage.setItem('obriy-language', 'en')
    localStorage.setItem('obriy-has-session', '1')
  }, theme)
  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: `map-region-${role.toLowerCase()}-token`,
        user: {
          id: `map-region-${role.toLowerCase()}`,
          email: `${role.toLowerCase()}@example.com`,
          role,
          status: 'ACTIVE',
          emailVerifiedAt: '2026-09-02T10:00:00.000Z',
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

async function mockMapCatalog(page: Page) {
  await page.route('**/map-presets', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([mapPreset()]),
    })
  })
}

async function mockGeoJson(page: Page) {
  await page.route('**/maps/world-adm0.geojson', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/geo+json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              featureId: 'IND',
              shapeISO: 'IND',
              name: 'India',
              nameEn: 'India',
              nameUk: 'Індія',
            },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [68, 8],
                  [97, 8],
                  [97, 35],
                  [68, 35],
                  [68, 8],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: {
              featureId: 'PRI',
              shapeISO: 'PRI',
              name: 'Puerto Rico',
              nameEn: 'Puerto Rico',
              nameUk: 'Пуерто-Рико',
            },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-68, 17],
                  [-65, 17],
                  [-65, 19],
                  [-68, 19],
                  [-68, 17],
                ],
              ],
            },
          },
        ],
      }),
    })
  })
}

async function mockStudentLesson(page: Page) {
  let started = false
  let responseData: Record<string, unknown> = {}
  const attempt = () => ({
    id: 'attempt-region',
    attemptNumber: 1,
    status: 'IN_PROGRESS',
    maxPoints: 5,
    scorePoints: null,
    scorePercent: null,
    isPassed: null,
    pendingReviewCount: 0,
    answers: [
      {
        id: 'answer-region',
        testItemId: 'item-region',
        status: 'DRAFT',
        responseData,
        maxPoints: 5,
        scorePoints: null,
        scorePercent: null,
        isCorrect: null,
        teacherComment: null,
        solutionFeedback: null,
      },
    ],
    startedAt: '2026-09-02T10:00:00.000Z',
    expiresAt: null,
    submittedAt: null,
    gradedAt: null,
  })
  const release = (includeItems: boolean) => ({
    releaseId: 'release-region',
    testId: 'test-region',
    testRevisionId: 'test-revision-region',
    title: 'Country check',
    description: 'Choose the requested country.',
    instructions: null,
    maxPoints: 5,
    passingPercent: 60,
    isRequired: true,
    maxAttempts: 1,
    timeLimitSeconds: null,
    dueAt: null,
    stateStatus: started ? 'IN_PROGRESS' : 'NOT_STARTED',
    itemCount: 1,
    items: includeItems
      ? [
          {
            id: 'item-region',
            position: 0,
            maxPoints: 5,
            assignmentId: 'assignment-region',
            assignmentRevisionId: 'revision-region',
            type: 'MAP_REGION',
            title: 'Find India',
            prompt: 'Choose India on the map.',
            instructions: null,
            publicConfig: { initialProjection: 'MERCATOR' },
            mapPreset: mapPreset(),
          },
        ]
      : [],
    attempt: started ? attempt() : null,
  })

  await page.route('**/classes/me/lessons/lesson-region', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'lesson-region',
        title: 'Map lesson',
        summary: 'Practice geographic orientation.',
        content: 'Use the map to answer the question.',
        contentLocale: 'EN',
        estimatedMinutes: 10,
        position: 0,
        class: { id: 'class-region', name: 'Geography club' },
        teacher: { id: 'teacher-region', displayName: 'Map Teacher' },
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
  })
  await page.route(
    '**/classes/me/lessons/lesson-region/assignments',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      })
    },
  )
  await page.route(
    '**/classes/me/lessons/lesson-region/tests',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([release(started)]),
      })
    },
  )
  await page.route('**/test-releases/release-region', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(release(started)),
    })
  })
  await page.route(
    '**/test-releases/release-region/attempts',
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
    '**/test-attempts/attempt-region/answers/item-region',
    async (route) => {
      const body = (await route.request().postDataJSON()) as {
        responseData?: Record<string, unknown>
      }
      responseData = body.responseData ?? {}
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

async function mockOpenFreeMapStyle(page: Page, theme: 'day' | 'night') {
  await page.route('https://tiles.openfreemap.org/styles/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        name: 'MAP_REGION smoke style',
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

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
}
