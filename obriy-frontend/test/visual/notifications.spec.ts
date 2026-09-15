import { expect, test, type Page } from '@playwright/test'

for (const scenario of [
  { name: 'desktop-day-en', width: 1440, height: 900, language: 'en', theme: 'day' },
  { name: 'tablet-night-uk', width: 1024, height: 900, language: 'uk', theme: 'night' },
  { name: 'mobile-day-uk', width: 390, height: 844, language: 'uk', theme: 'day' },
] as const) {
  test(`notification center stays usable on ${scenario.name}`, async ({ page }) => {
    await page.setViewportSize(scenario)
    await prepareSession(page, scenario.language, scenario.theme)
    await mockNotifications(page)
    await page.goto('/app/student')

    await page.getByRole('button', {
      name: scenario.language === 'en' ? 'Open notifications' : 'Відкрити сповіщення',
    }).click()
    await expect(page.getByRole('heading', {
      name: scenario.language === 'en' ? 'Notifications' : 'Сповіщення',
    })).toBeVisible()
    await expect(page.getByText('Early states')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByText('Early states').click()
    await expect(page).toHaveURL(/\/app\/student\/lessons\/lesson-1\?test=release-1/)
  })
}

async function prepareSession(
  page: Page,
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
        accessToken: 'notification-token',
        user: {
          id: 'student-1',
          email: 'student@example.com',
          role: 'STUDENT',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-09-01T10:00:00.000Z',
          hasPassword: true,
          profile: {
            displayName: 'Marta',
            avatarUrl: null,
            bio: null,
            subjectArea: null,
            preferredLocale: language === 'en' ? 'EN' : 'UK',
          },
        },
      }),
    })
  })
  await page.route('**/gamification/me/rewards/unseen', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ xp: [], badges: [] }) }),
  )
  await page.route('**/student/dashboard', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  )
}

async function mockNotifications(page: Page) {
  await page.route('**/notifications/unread-count', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unreadCount: 1 }) }),
  )
  await page.route('**/notifications?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 'notification-1',
          type: 'TEST_AVAILABLE',
          subjectStudentId: 'student-1',
          payload: { lessonId: 'lesson-1', releaseId: 'release-1', testTitle: 'Early states' },
          isRead: false,
          readAt: null,
          createdAt: '2026-09-11T12:00:00.000Z',
        }],
        nextCursor: null,
        unreadCount: 1,
      }),
    }),
  )
  await page.route('**/notifications/notification-1/read', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'notification-1', type: 'TEST_AVAILABLE', subjectStudentId: 'student-1', payload: {},
        isRead: true, readAt: '2026-09-11T12:01:00.000Z', createdAt: '2026-09-11T12:00:00.000Z',
      }),
    }),
  )
  await page.route('**/lessons/lesson-1**', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
  )
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
}
