import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 1000, theme: 'day' },
  { name: 'mobile', width: 390, height: 844, theme: 'night' },
] as const

for (const viewport of viewports) {
  test(`MAP_POINT teacher editor renders in 2D and globe on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareSession(page, 'TEACHER', viewport.theme)
    await mockMapCatalog(page)
    await mockOpenFreeMapStyle(page, viewport.theme)

    await page.goto('/app/teacher/tasks/new/map_point')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page
      .getByRole('combobox', { name: 'Geographic dataset' })
      .selectOption('preset-ukraine')

    const mapRegion = page.getByRole('region', {
      name: 'Correct map point editor',
    })
    await expect(mapRegion.locator('canvas.maplibregl-canvas')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Initial view' }),
    ).toBeVisible()
    const mapBox = await mapRegion.boundingBox()
    expect(mapBox).not.toBeNull()
    await mapRegion.click({
      position: { x: mapBox!.width * 0.5, y: mapBox!.height * 0.5 },
    })
    await expect(page.locator('.maplibregl-marker')).toHaveCount(2)
    await page.getByRole('spinbutton', { name: 'Radius, km' }).fill('150')
    await expect(
      page.getByRole('spinbutton', { name: 'Radius, km' }),
    ).toHaveValue('150')
    await page.getByRole('radio', { name: 'Globe' }).check()
    await expect(page.getByRole('radio', { name: 'Globe' })).toBeChecked()
    await expectNoHorizontalOverflow(page)

    await page.screenshot({
      path: testInfo.outputPath(`map-point-teacher-${viewport.name}.png`),
      fullPage: true,
    })
  })

  test(`MAP_POINT student runner renders in 2D and globe on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareSession(page, 'STUDENT', viewport.theme)
    await mockStudentLesson(page)
    await mockOpenFreeMapStyle(page, viewport.theme)

    await page.goto('/app/student/lessons/lesson-map')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Start' }).click()
    const dialog = page.getByRole('dialog', { name: 'Map point check' })
    await dialog.getByRole('button', { name: 'Start' }).click()

    const mapRegion = dialog.getByRole('region', {
      name: 'Map for the student answer',
    })
    const canvas = mapRegion.locator('canvas.maplibregl-canvas')
    await expect(canvas).toBeVisible()
    const mapBox = await mapRegion.boundingBox()
    expect(mapBox).not.toBeNull()
    await mapRegion.click({
      position: { x: mapBox!.width * 0.52, y: mapBox!.height * 0.48 },
    })
    await expect(dialog.locator('.maplibregl-marker')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Globe' }).click()
    await expect(dialog.getByRole('button', { name: 'Globe' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expectNoHorizontalOverflow(page)

    await page.screenshot({
      path: testInfo.outputPath(`map-point-student-${viewport.name}.png`),
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
        accessToken: `map-point-${role.toLowerCase()}-token`,
        user: {
          id: `map-${role.toLowerCase()}`,
          email: `${role.toLowerCase()}@example.com`,
          role,
          status: 'ACTIVE',
          emailVerifiedAt: '2026-08-25T12:00:00.000Z',
          profile: {
            displayName: role === 'TEACHER' ? 'Map Teacher' : 'Map Student',
            avatarUrl: null,
            bio: null,
            gradeLevel: role === 'STUDENT' ? 8 : null,
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

async function mockStudentLesson(page: Page) {
  let started = false
  let responseData: Record<string, unknown> = {}
  const attempt = () => ({
    id: 'attempt-map',
    attemptNumber: 1,
    status: 'IN_PROGRESS',
    maxPoints: 5,
    scorePoints: null,
    scorePercent: null,
    isPassed: null,
    pendingReviewCount: 0,
    answers: [
      {
        id: 'answer-map',
        testItemId: 'item-map',
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
    startedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: null,
    submittedAt: null,
    gradedAt: null,
  })
  const release = (includeItems: boolean) => ({
    releaseId: 'release-map',
    testId: 'test-map',
    testRevisionId: 'test-revision-map',
    title: 'Map point check',
    description: 'Find the requested city.',
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
            id: 'item-map',
            position: 0,
            maxPoints: 5,
            assignmentId: 'assignment-map',
            assignmentRevisionId: 'revision-map',
            type: 'MAP_POINT',
            title: 'Find Kyiv',
            prompt: 'Mark Kyiv on the map.',
            instructions: null,
            publicConfig: { initialProjection: 'MERCATOR' },
            mapPreset: mapPreset(),
          },
        ]
      : [],
    attempt: started ? attempt() : null,
  })

  await page.route('**/classes/me/lessons/lesson-map', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'lesson-map',
        title: 'Map lesson',
        summary: 'Practice geographic orientation.',
        content: 'Use the map to answer the question.',
        contentLocale: 'EN',
        estimatedMinutes: 10,
        position: 0,
        class: { id: 'class-map', name: 'Geography club' },
        teacher: { id: 'teacher-map', displayName: 'Map Teacher' },
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
    '**/classes/me/lessons/lesson-map/assignments',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      })
    },
  )
  await page.route('**/classes/me/lessons/lesson-map/tests', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([release(started)]),
    })
  })
  await page.route('**/test-releases/release-map', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(release(started)),
    })
  })
  await page.route('**/test-releases/release-map/attempts', async (route) => {
    started = true
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(attempt()),
    })
  })
  await page.route(
    '**/test-attempts/attempt-map/answers/item-map',
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
    id: 'preset-ukraine',
    key: 'ukraine-adm1',
    name: 'Regions of Ukraine',
    contentLocale: 'UK',
    sourceType: 'BUILT_IN',
    geojsonUrl: '/maps/ukraine-adm1.geojson',
    idProperty: 'featureId',
    year: 2017,
    attribution: 'geoBoundaries UKR ADM1 · ODbL 1.0',
    bounds: { west: 21.8, south: 44.2, east: 40.3, north: 52.5 },
    defaultViewport: { longitude: 31.2, latitude: 48.8, zoom: 4.6 },
  }
}

async function mockOpenFreeMapStyle(page: Page, theme: 'day' | 'night') {
  await page.route('https://tiles.openfreemap.org/styles/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        name: 'MAP_POINT smoke style',
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
