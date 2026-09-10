import { expect, test, type Page } from '@playwright/test'

test('student leaderboard is clear on desktop in Ukrainian day mode', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await prepareSession(page, 'STUDENT', 'uk', 'day')
  await mockLeaderboard(page, 'student')

  await page.goto('/app/student/leaderboard')

  await expect(page.getByRole('heading', { name: 'Рейтинг класу', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Лідери класу' })).toBeVisible()
  await expect(page.getByText('Ваше місце')).toBeVisible()
  await expect(page.getByRole('button', { name: 'За весь час' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('leaderboard-student-desktop-day.png'),
    fullPage: true,
  })
})

test('student leaderboard remains usable on mobile in English night mode', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepareSession(page, 'STUDENT', 'en', 'night')
  await mockLeaderboard(page, 'student')

  await page.goto('/app/student/leaderboard')
  await page.getByRole('button', { name: 'All time' }).click()

  await expect(page).toHaveURL(/period=ALL_TIME/)
  await expect(page.getByRole('heading', { name: 'Class leaders' })).toBeVisible()
  await expect(page.getByText('Your place')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('leaderboard-student-mobile-night.png'),
    fullPage: true,
  })
})

test('teacher opens the class leaderboard inside analytics at 1024px', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await prepareSession(page, 'TEACHER', 'en', 'day')
  await mockTeacherAnalytics(page)
  await mockLeaderboard(page, 'teacher')

  await page.goto('/app/teacher/analytics?classId=class-1&tab=leaderboard')

  await expect(page.getByRole('tab', { name: 'Leaderboard' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Class leaders' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Anna/ }).first(),
  ).toHaveAttribute(
    'href',
    '/app/teacher/analytics/classes/class-1/students/student-1',
  )
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('leaderboard-teacher-tablet.png'),
    fullPage: true,
  })
})

async function prepareSession(
  page: Page,
  role: 'STUDENT' | 'TEACHER',
  language: 'en' | 'uk',
  theme: 'day' | 'night',
) {
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem('obriy-theme', theme)
    localStorage.setItem('obriy-language', language)
    localStorage.setItem('obriy-has-session', '1')
  }, { language, theme })
  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'leaderboard-token',
        user: {
          id: role === 'STUDENT' ? 'student-self' : 'teacher-1',
          email: 'person@example.com',
          role,
          status: 'ACTIVE',
          emailVerifiedAt: '2026-09-01T10:00:00.000Z',
          profile: {
            displayName: role === 'STUDENT' ? 'Zed' : 'Teacher',
            avatarUrl: null,
            bio: null,
            gradeLevel: role === 'STUDENT' ? 8 : null,
            subjectArea: role === 'TEACHER' ? 'History' : null,
            preferredLocale: language === 'en' ? 'EN' : 'UK',
          },
        },
      }),
    })
  })
  await page.route('**/gamification/me/rewards/unseen', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ xp: [], badges: [] }),
    })
  })
}

async function mockLeaderboard(page: Page, mode: 'student' | 'teacher') {
  const path = mode === 'student'
    ? '**/leaderboard/me**'
    : '**/teacher/leaderboard/classes/class-1**'
  await page.route(path, async (route) => {
    const period = new URL(route.request().url()).searchParams.get('period') ?? 'WEEK'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        class: { id: 'class-1', name: 'History club', studentCount: 5 },
        period: {
          type: period,
          startAt: period === 'WEEK' ? '2026-09-06T21:00:00.000Z' : null,
          endAt: period === 'WEEK' ? '2026-09-13T21:00:00.000Z' : null,
        },
        entries: [
          entry('student-1', 'Anna', 1, 320),
          entry('student-2', 'Bohdan', 2, 210),
          entry('student-3', 'Charlie', 3, 120),
        ],
        selfEntry:
          mode === 'student'
            ? { ...entry('student-self', 'Zed', 5, 0), isCurrentUser: true }
            : null,
        nextCursor: null,
      }),
    })
  })
}

async function mockTeacherAnalytics(page: Page) {
  await page.route('**/classes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'class-1',
          name: 'History club',
          studentCount: 5,
          createdAt: '2026-09-01T10:00:00.000Z',
          updatedAt: '2026-09-01T10:00:00.000Z',
        },
      ]),
    })
  })
  await page.route('**/teacher/analytics/classes/class-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        class: { id: 'class-1', name: 'History club' },
        metrics: {
          studentCount: 5,
          requiredReleaseCount: 2,
          requiredWorkCount: 10,
          completedWorkCount: 6,
          completionPercent: 60,
          averagePercent: 78,
          awaitingReviewCount: 1,
        },
        students: [],
        lessons: [],
      }),
    })
  })
}

function entry(id: string, displayName: string, rank: number, periodXp: number) {
  return {
    id,
    displayName,
    rank,
    avatarUrl: null,
    periodXp,
    totalXp: periodXp + 500,
    level: 2,
    showcase: [],
    lastXpAt: '2026-09-09T10:00:00.000Z',
    isCurrentUser: false,
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
}
