import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'compact-desktop', width: 1024, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

for (const viewport of viewports) {
  test(`teacher test actions stay clear of global controls on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareTeacherSession(page)
    await page.route('**/tests?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], nextCursor: null }),
      })
    })

    await page.goto('/app/teacher/tests')
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await expect(page.getByRole('heading', { level: 1, name: 'Tests' })).toBeVisible()
    await expect(page.getByText('Assessment lab')).toHaveCount(0)

    const globalControls = page.locator('[aria-label="Global settings"]')
    const createAction = page.getByRole('button', { name: 'Create test' }).first()
    await expect(globalControls).toBeVisible()
    await expect(createAction).toBeVisible()
    expect(
      rectanglesOverlap(
        await globalControls.boundingBox(),
        await createAction.boundingBox(),
      ),
    ).toBe(false)

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)

    await page.screenshot({
      path: testInfo.outputPath(`teacher-tests-${viewport.name}.png`),
      fullPage: true,
    })
  })
}

for (const viewport of viewports) {
  test(`test release manager stays usable on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareTeacherSession(page)
    await prepareReleaseEditorMocks(page)

    await page.goto('/app/teacher/lessons/lesson-1/edit')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Configure the test for classes' }).click()

    const dialog = page.getByRole('dialog', { name: 'Class release settings' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'History class' })).toBeVisible()
    await expect(dialog.getByText('Draft', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Configure' })).toBeVisible()

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)

    await page.screenshot({
      path: testInfo.outputPath(`teacher-test-releases-${viewport.name}.png`),
      fullPage: true,
    })
  })
}

function rectanglesOverlap(
  first: { x: number; y: number; width: number; height: number } | null,
  second: { x: number; y: number; width: number; height: number } | null,
) {
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  return !(
    first!.x + first!.width <= second!.x ||
    second!.x + second!.width <= first!.x ||
    first!.y + first!.height <= second!.y ||
    second!.y + second!.height <= first!.y
  )
}

async function prepareTeacherSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('obriy-theme', 'day')
    localStorage.setItem('obriy-language', 'en')
    localStorage.setItem('obriy-has-session', '1')
  })

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'teacher-tests-layout-token',
        user: {
          id: 'teacher-tests-layout',
          email: 'teacher@example.com',
          role: 'TEACHER',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-09-07T12:00:00.000Z',
          profile: {
            displayName: 'Layout Teacher',
            avatarUrl: null,
            bio: null,
            gradeLevel: null,
            subjectArea: 'History',
            preferredLocale: 'EN',
          },
        },
      }),
    })
  })
}

async function prepareReleaseEditorMocks(page: Page) {
  await page.route('**/lessons/lesson-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'lesson-1',
        title: 'Source lesson',
        summary: 'A lesson with a scheduled knowledge check.',
        content: '<p>Read the sources.</p>',
        contentLocale: 'UK',
        estimatedMinutes: 20,
        status: 'PUBLISHED',
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-10T10:00:00.000Z',
        classLinks: [
          {
            classId: 'class-1',
            className: 'History class',
            position: 0,
            publishedAt: '2026-09-05T10:00:00.000Z',
          },
        ],
      }),
    })
  })
  await page.route('**/classes', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/lessons/lesson-1/assignments', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/lessons/lesson-1/assignment-attempts**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], nextCursor: null }) })
  })
  await page.route('**/lessons/lesson-1/test-attempts**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], nextCursor: null }) })
  })
  await page.route('**/lessons/lesson-1/tests', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'lesson-test-1',
          lessonId: 'lesson-1',
          testId: 'test-1',
          testRevisionId: 'revision-1',
          revisionVersion: 1,
          position: 0,
          title: 'Source test',
          description: 'Check source interpretation.',
          itemCount: 4,
          maxPoints: 20,
          hasUpdate: false,
          activeReleaseCount: 0,
          releaseCount: 1,
          releaseStatuses: ['DRAFT'],
          linkedAt: '2026-09-10T10:00:00.000Z',
        },
      ]),
    })
  })
  await page.route('**/lessons/lesson-1/tests/test-1/releases', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'release-1',
          lessonId: 'lesson-1',
          testId: 'test-1',
          testRevisionId: 'revision-1',
          class: { id: 'class-1', name: 'History class' },
          status: 'DRAFT',
          isRequired: true,
          availableFrom: null,
          dueAt: '2026-09-20T12:00:00.000Z',
          maxAttempts: 2,
          latePolicy: 'DISALLOW',
          latePenaltyPercent: null,
          xpReward: 100,
          attemptCount: 0,
          inProgressCount: 0,
          publishedAt: null,
          closedAt: null,
          updatedAt: '2026-09-10T10:00:00.000Z',
        },
      ]),
    })
  })
}
