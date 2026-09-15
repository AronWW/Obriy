import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop-day-en', width: 1440, height: 900, theme: 'day', language: 'en' },
  { name: 'compact-night-uk', width: 1024, height: 900, theme: 'night', language: 'uk' },
  { name: 'mobile-day-uk', width: 390, height: 844, theme: 'day', language: 'uk' },
] as const

for (const viewport of viewports) {
  test(`teacher analytics stays usable on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareAnalytics(page, viewport.theme, viewport.language)
    await page.goto('/app/teacher/analytics?classId=class-1&tab=students')
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await expect(page.getByRole('heading', {
      level: 1,
      name: viewport.language === 'en' ? 'Class analytics' : 'Аналітика класів',
    })).toBeVisible()
    await expect(page.getByRole('combobox', {
      name: viewport.language === 'en' ? 'Class' : 'Клас',
    })).toBeVisible()
    await expect(page.getByRole('link', {
      name: viewport.language === 'en'
        ? 'Open results for Marta Ivaniuk'
        : 'Відкрити результати учня Марта Іванюк',
    })).toBeVisible()

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)

    const globalControls = viewport.width <= 760
      ? page.getByRole('button', { name: viewport.language === 'en' ? 'Open menu' : 'Відкрити меню' })
      : page.getByLabel(viewport.language === 'en' ? 'Global settings' : 'Глобальні налаштування')
    expect(rectanglesOverlap(
      await globalControls.boundingBox(),
      await page.getByRole('combobox', { name: viewport.language === 'en' ? 'Class' : 'Клас' }).boundingBox(),
    )).toBe(false)

    await page.getByRole('tab', {
      name: viewport.language === 'en' ? 'Materials' : 'Матеріали',
    }).click()
    await expect(page.getByText(viewport.language === 'en' ? 'Source analysis' : 'Аналіз джерел')).toBeVisible()

    await page.screenshot({
      path: testInfo.outputPath(`teacher-analytics-${viewport.name}.png`),
      fullPage: true,
    })
  })
}

test('teacher opens a student attempt from analytics', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await prepareAnalytics(page, 'day', 'en')
  await page.goto('/app/teacher/analytics/classes/class-1/students/student-1')

  await expect(page.getByRole('heading', { level: 1, name: 'Marta Ivaniuk' })).toBeVisible()
  await expect(page.getByText('Attempt #1')).toBeVisible()
  await expect(page.getByRole('link', { name: /Review/ })).toHaveAttribute(
    'href',
    '/app/teacher/lessons/lesson-1/edit?reviewAttempt=attempt-1',
  )
})

async function prepareAnalytics(
  page: Page,
  theme: 'day' | 'night',
  language: 'en' | 'uk',
) {
  await page.addInitScript(
    ({ selectedLanguage, selectedTheme }) => {
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
        accessToken: 'teacher-analytics-token',
        user: {
          id: 'teacher-1', email: 'teacher@example.com', role: 'TEACHER', status: 'ACTIVE',
          emailVerifiedAt: '2026-09-01T10:00:00.000Z',
          hasPassword: true,
          profile: { displayName: 'Olena', avatarUrl: null, bio: null, subjectArea: 'History', preferredLocale: language === 'en' ? 'EN' : 'UK' },
        },
      }),
    })
  })
  await page.route('**/classes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'class-1', name: language === 'en' ? 'History club' : 'Історичний гурток', studentCount: 1, createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' }]),
    })
  })
  await page.route('http://localhost:3000/teacher/analytics/classes/class-1', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(classFixture(language)) })
  })
  await page.route('http://localhost:3000/teacher/analytics/classes/class-1/students/student-1', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(studentFixture(language)) })
  })
}

function classFixture(language: 'en' | 'uk') {
  const studentName = language === 'en' ? 'Marta Ivaniuk' : 'Марта Іванюк'
  const lessonTitle = language === 'en' ? 'Kyivan Rus' : 'Київська Русь'
  const testTitle = language === 'en' ? 'Source analysis' : 'Аналіз джерел'
  const counts = { notStarted: 0, inProgress: 0, awaitingReview: 1, needsRevision: 0, completed: 1, expired: 0 }
  return {
    class: { id: 'class-1', name: language === 'en' ? 'History club' : 'Історичний гурток' },
    metrics: { studentCount: 1, requiredReleaseCount: 2, requiredWorkCount: 2, completedWorkCount: 1, completionPercent: 50, averagePercent: 80, awaitingReviewCount: 1 },
    students: [{ id: 'student-1', displayName: studentName, avatarUrl: null, requiredCount: 2, completedCount: 1, completionPercent: 50, averagePercent: 80, statuses: counts, lastActivityAt: '2026-09-09T10:00:00.000Z' }],
    lessons: [{ id: 'lesson-1', title: lessonTitle, position: 1, requiredTestCount: 1, completionPercent: 50, averagePercent: 80, tests: [{ releaseId: 'release-1', testId: 'test-1', title: testTitle, releaseStatus: 'ACTIVE', isRequired: true, availableFrom: null, dueAt: '2026-09-20T10:00:00.000Z', maxPoints: 10, passingPercent: 60, studentCount: 1, completionPercent: 50, averagePercent: 80, statuses: counts }] }],
  }
}

function studentFixture(language: 'en' | 'uk') {
  const overview = classFixture(language)
  const test = overview.lessons[0].tests[0]
  return {
    class: overview.class,
    student: overview.students[0],
    lessons: [{ id: 'lesson-1', title: overview.lessons[0].title, position: 1, tests: [{
      ...test, status: 'AWAITING_REVIEW', scorePoints: null, scorePercent: null, bestPoints: 8, bestPercent: 80, attemptCount: 1, isLate: false, lastActivityAt: '2026-09-09T10:00:00.000Z',
      attempts: [{ id: 'attempt-1', attemptNumber: 1, status: 'AWAITING_REVIEW', maxPoints: 10, scorePoints: null, scorePercent: null, isPassed: null, pendingReviewCount: 1, isLate: false, startedAt: '2026-09-09T09:00:00.000Z', submittedAt: '2026-09-09T10:00:00.000Z', gradedAt: null }],
    }] }],
  }
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
