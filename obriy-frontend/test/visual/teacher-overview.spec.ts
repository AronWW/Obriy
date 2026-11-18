import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop-day-en', width: 1440, height: 900, theme: 'day', language: 'en' },
  { name: 'compact-day-en', width: 1024, height: 900, theme: 'day', language: 'en' },
  { name: 'mobile-night-uk', width: 390, height: 844, theme: 'night', language: 'uk' },
] as const

for (const viewport of viewports) {
  test(`teacher overview stays usable on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareTeacherOverview(page, viewport.theme, viewport.language)
    await page.goto('/app/teacher')
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: viewport.language === 'en' ? 'Overview' : 'Огляд',
      }),
    ).toBeVisible()
    const globalControls =
      viewport.width <= 760
        ? page.getByRole('button', {
            name: viewport.language === 'en' ? 'Open menu' : 'Відкрити меню',
          })
        : page.locator('[aria-label="Global settings"]')
    const quickActions = page.getByRole('navigation', {
      name: viewport.language === 'en' ? 'Quick actions' : 'Швидкі дії',
    })
    await expect(globalControls).toBeVisible()
    await expect(quickActions).toBeVisible()
    expect(
      rectanglesOverlap(
        await globalControls.boundingBox(),
        await quickActions.boundingBox(),
      ),
    ).toBe(false)

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)

    await page.screenshot({
      path: testInfo.outputPath(`teacher-overview-${viewport.name}.png`),
      fullPage: true,
    })
  })
}

async function prepareTeacherOverview(
  page: Page,
  theme: 'day' | 'night',
  language: 'en' | 'uk',
) {
  await page.addInitScript(
    ({ selectedLanguage, selectedTheme }) => {
      localStorage.setItem('obriy-night-default-v1', 'done')
      localStorage.setItem('obriy-theme', selectedTheme)
      localStorage.setItem('obriy-language', selectedLanguage)
      localStorage.setItem('obriy-has-session', '1')
    },
    { selectedLanguage: language, selectedTheme: theme },
  )
  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'teacher-overview-token',
        user: {
          id: 'teacher-overview-user',
          email: 'teacher@example.com',
          role: 'TEACHER',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-09-01T10:00:00.000Z',
          hasPassword: true,
          profile: {
            displayName: language === 'en' ? 'Olena' : 'Олена',
            avatarUrl: null,
            bio: null,
            subjectArea: 'History',
            preferredLocale: language === 'en' ? 'EN' : 'UK',
          },
        },
      }),
    })
  })
  await page.route('**/teacher/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dashboardFixture),
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

const dashboardFixture = {
  stats: {
    classes: { total: 3, studentCount: 42 },
    lessons: { total: 17, drafts: 4 },
    assignments: { total: 28, drafts: 5 },
    tests: { total: 8, drafts: 2 },
    pendingReviews: 2,
  },
  pendingReviews: [
    {
      attemptId: 'attempt-1',
      lessonId: 'lesson-1',
      lessonTitle: 'Kyivan Rus',
      testTitle: 'Written sources',
      studentId: 'student-1',
      studentName: 'Marta',
      classId: 'class-1',
      className: 'History club',
      pendingReviewCount: 2,
      submittedAt: '2026-09-09T09:30:00.000Z',
    },
  ],
  recent: {
    lessons: [{ id: 'lesson-1', title: 'Kyivan Rus', status: 'PUBLISHED', classCount: 2, updatedAt: '2026-09-08T11:00:00.000Z' }],
    assignments: [{ id: 'assignment-1', title: 'Compare sources', type: 'WRITTEN', status: 'DRAFT', updatedAt: '2026-09-08T10:00:00.000Z' }],
    tests: [{ id: 'test-1', title: 'Topic check', status: 'PUBLISHED', itemCount: 5, updatedAt: '2026-09-07T10:00:00.000Z' }],
  },
}
