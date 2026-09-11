import { expect, test, type Page } from '@playwright/test'

for (const scenario of [
  { width: 1440, height: 1000, language: 'uk', theme: 'day', name: 'desktop-day-uk' },
  { width: 1024, height: 900, language: 'en', theme: 'day', name: 'tablet-day-en' },
  { width: 390, height: 844, language: 'en', theme: 'night', name: 'mobile-night-en' },
] as const) {
  test(`student achievements remain usable on ${scenario.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height })
    await prepareSession(page, scenario.language, scenario.theme)
    await mockAchievements(page, scenario.language)

    await page.goto('/app/student/achievements')

    await expect(page.getByRole('heading', { name: scenario.language === 'uk' ? 'Досягнення' : 'Achievements', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: scenario.language === 'uk' ? 'Колекція' : 'Collection' })).toBeVisible()
    await expect(page.getByText('3/5')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({
      path: testInfo.outputPath(`achievements-${scenario.name}.png`),
      fullPage: true,
    })
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
        accessToken: 'achievements-token',
        user: {
          id: 'student-1',
          email: 'student@example.com',
          role: 'STUDENT',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-09-01T10:00:00.000Z',
          profile: {
            displayName: 'Marta',
            avatarUrl: null,
            bio: null,
            gradeLevel: 8,
            subjectArea: null,
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

async function mockAchievements(page: Page, language: 'en' | 'uk') {
  await page.route('**/gamification/me/achievements', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        progress: {
          totalXp: 700,
          level: 2,
          levelStartXp: 500,
          nextLevelXp: 1500,
          xpIntoLevel: 200,
          xpForNextLevel: 1000,
        },
        summary: { earnedCount: 2, totalCount: 4 },
        showcase: [earnedBadge('badge-1', localizedName(language, 'First Step', 'Перший крок'), 'footprints', 1)],
        badges: [
          earnedBadge('badge-1', localizedName(language, 'First Step', 'Перший крок'), 'footprints', 1),
          earnedBadge('badge-2', localizedName(language, 'Perfect Result', 'Бездоганний результат'), 'sparkles', null),
          lockedBadge('badge-3', localizedName(language, 'Steady Path', 'Впевнений шлях'), 'compass', 3, 5),
          lockedBadge('badge-4', localizedName(language, 'Ten Strong', 'Десятка'), 'medal', 3, 10),
        ],
      }),
    })
  })
}

function earnedBadge(
  id: string,
  name: string,
  iconKey: string,
  showcasePosition: number | null,
) {
  return {
    id,
    key: name.toUpperCase().replaceAll(' ', '_'),
    iconKey,
    name,
    description: `${name} achievement description.`,
    status: 'EARNED',
    criteriaType: 'PASSED_TEST_COUNT',
    progress: { current: 1, target: 1, percent: 100 },
    earnedAt: '2026-09-10T10:00:00.000Z',
    showcasePosition,
  }
}

function lockedBadge(
  id: string,
  name: string,
  iconKey: string,
  current: number,
  target: number,
) {
  return {
    id,
    key: name.toUpperCase().replaceAll(' ', '_'),
    iconKey,
    name,
    description: `${name} achievement description.`,
    status: 'LOCKED',
    criteriaType: 'PASSED_TEST_COUNT',
    progress: { current, target, percent: Math.round((current / target) * 100) },
    earnedAt: null,
    showcasePosition: null,
  }
}

function localizedName(language: 'en' | 'uk', en: string, uk: string) {
  return language === 'uk' ? uk : en
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
}
