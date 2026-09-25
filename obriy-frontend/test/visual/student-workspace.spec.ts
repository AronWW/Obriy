import { expect, test, type Locator, type Page } from '@playwright/test'

const viewports = [
  { name: 'desktop-day-en', width: 1440, height: 900, theme: 'day', language: 'en' },
  { name: 'compact-night-uk', width: 1024, height: 900, theme: 'night', language: 'uk' },
  { name: 'mobile-day-uk', width: 390, height: 844, theme: 'day', language: 'uk' },
] as const

for (const viewport of viewports) {
  test(`student overview and tasks stay usable on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await prepareWorkspace(page, viewport.theme, viewport.language)
    await page.goto('/app/student')
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await expect(page.getByRole('heading', {
      level: 1,
      name: viewport.language === 'en' ? 'Overview' : 'Огляд',
    })).toBeVisible()
    await expect(page.getByText(viewport.language === 'en' ? 'Revise chronology' : 'Повторити хронологію')).toBeVisible()
    const progressCard = page.getByLabel(
      viewport.language === 'en' ? 'XP and level progress' : 'Прогрес XP і рівня',
    )
    await expect(progressCard).toBeVisible()
    await expectProgressContentToFit(progressCard)
    await expectNoOverflow(page)

    await page.goto('/app/student/tasks?status=SCHEDULED')
    await expect(page.getByRole('heading', {
      level: 1,
      name: viewport.language === 'en' ? 'My assignments' : 'Мої завдання',
    })).toBeVisible()
    await expect(page.getByText(viewport.language === 'en' ? 'Not open yet' : 'Ще не відкрито')).toBeVisible()
    await expect(page.getByRole('searchbox')).toBeVisible()
    await expectNoOverflow(page)

    await page.screenshot({
      path: testInfo.outputPath(`student-workspace-${viewport.name}.png`),
      fullPage: true,
    })
  })
}

async function prepareWorkspace(
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
        accessToken: 'student-workspace-token',
        user: {
          id: 'student-1',
          email: 'student@example.com',
          role: 'STUDENT',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-09-01T10:00:00.000Z',
          hasPassword: true,
          profile: {
            displayName: language === 'en' ? 'Marta' : 'Марта',
            avatarUrl: null,
            bio: null,
            subjectArea: null,
            preferredLocale: language === 'en' ? 'EN' : 'UK',
          },
        },
      }),
    })
  })
  await page.route('http://localhost:3000/student/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dashboardFixture(language)),
    })
  })
  await page.route('http://localhost:3000/student/tasks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tasksFixture(language)),
    })
  })
  await page.route('http://localhost:3000/gamification/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        progress: {
          totalXp: 0,
          level: 1,
          levelStartXp: 0,
          nextLevelXp: 500,
          xpIntoLevel: 0,
          xpForNextLevel: 500,
        },
        showcase: [],
        badges: [],
      }),
    })
  })
  await page.route(
    'http://localhost:3000/gamification/me/rewards/unseen',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ xp: [], badges: [] }),
      })
    },
  )
}

function work(language: 'en' | 'uk', scheduled = false) {
  return {
    releaseId: scheduled ? 'release-scheduled' : 'release-revision',
    testId: scheduled ? 'test-scheduled' : 'test-revision',
    title: scheduled
      ? language === 'en' ? 'Scheduled map' : 'Запланована мапа'
      : language === 'en' ? 'Revise chronology' : 'Повторити хронологію',
    description: language === 'en' ? 'A short test description.' : 'Короткий опис тесту.',
    lesson: { id: 'lesson-1', title: language === 'en' ? 'Early states' : 'Перші держави', position: 1 },
    releaseStatus: scheduled ? 'SCHEDULED' : 'ACTIVE',
    isRequired: true,
    availability: scheduled ? 'SCHEDULED' : 'AVAILABLE',
    stateStatus: scheduled ? 'NOT_STARTED' : 'NEEDS_REVISION',
    availableFrom: scheduled ? '2026-09-18T12:00:00.000Z' : null,
    dueAt: scheduled ? null : '2026-09-15T12:00:00.000Z',
    maxPoints: 10,
    scorePoints: null,
    scorePercent: null,
    bestPoints: null,
    bestPercent: null,
    attemptCount: scheduled ? 0 : 1,
    lastActivityAt: scheduled ? null : '2026-09-09T12:00:00.000Z',
    attentionReason: scheduled ? null : 'NEEDS_REVISION',
    isOverdue: false,
    canOpen: !scheduled,
  }
}

function dashboardFixture(language: 'en' | 'uk') {
  return {
    class: { id: 'class-1', name: language === 'en' ? 'History club' : 'Історичний гурток' },
    metrics: { requiredReleaseCount: 4, completedCount: 2, completionPercent: 50, averagePercent: 72, attentionCount: 1, nextDueAt: '2026-09-15T12:00:00.000Z' },
    attention: [work(language)],
    upcoming: [work(language, true)],
    continueLessons: [{ id: 'lesson-1', title: language === 'en' ? 'Early states' : 'Перші держави', position: 1, workCount: 2, requiredCount: 2, completedRequiredCount: 0, nextReleaseId: 'release-revision' }],
  }
}

function tasksFixture(language: 'en' | 'uk') {
  return {
    class: { id: 'class-1', name: language === 'en' ? 'History club' : 'Історичний гурток' },
    items: [work(language, true)],
    nextCursor: null,
  }
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
}

async function expectProgressContentToFit(
  progressCard: Locator,
) {
  const fits = await progressCard.evaluate((card) => {
    const cardRect = card.getBoundingClientRect()
    const medallion = card.firstElementChild
    if (!(medallion instanceof HTMLElement)) return false
    const medallionRect = medallion.getBoundingClientRect()
    const isInside = (outer: DOMRect, inner: DOMRect) =>
      inner.left >= outer.left - 1 &&
      inner.right <= outer.right + 1 &&
      inner.top >= outer.top - 1 &&
      inner.bottom <= outer.bottom + 1

    return (
      [...medallion.querySelectorAll('strong, span')].every((element) =>
        isInside(medallionRect, element.getBoundingClientRect()),
      ) &&
      [...card.querySelectorAll('strong, span')].every((element) =>
        isInside(cardRect, element.getBoundingClientRect()),
      )
    )
  })

  expect(fits).toBe(true)
}
