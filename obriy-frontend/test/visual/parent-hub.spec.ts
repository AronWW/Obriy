import { expect, test, type Page } from '@playwright/test'

const linkedChildren = [
  {
    id: 'child-maria',
    displayName: 'Марія Коваль',
    avatarUrl: null,
  },
  {
    id: 'child-ostap',
    displayName: 'Остап Коваль',
    avatarUrl: null,
  },
  {
    id: 'child-solomia',
    displayName: 'Соломія Коваль',
    avatarUrl: null,
  },
]

test('parent family overview stays compact without a sidebar', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await prepareParentSession(page, 'day', linkedChildren)

  await page.goto('/app/parent')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', { name: 'Навчання ваших дітей' }),
  ).toBeVisible()
  await expect(page.locator('aside')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Марія Коваль/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Остап Коваль/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Соломія Коваль/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('parent-family-desktop.png'),
    fullPage: true,
  })
})

test('single-child parent report remains linear on mobile', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepareParentSession(page, 'night', [linkedChildren[0]])

  await page.goto('/app/parent/child/child-maria')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', { name: 'Марія Коваль' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Потребує уваги' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Докладний прогрес' }),
  ).toBeVisible()
  await expect(page.locator('aside')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: testInfo.outputPath('parent-child-mobile-night.png'),
    fullPage: true,
  })
})

test('parent family overview remains readable on an English tablet', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await prepareParentSession(page, 'day', linkedChildren, 'en')
  await page.goto('/app/parent')

  await expect(
    page.getByRole('heading', { name: 'Your children’s learning' }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('parent profile remains usable without a sidebar on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepareParentSession(page, 'night', linkedChildren, 'en')
  await page.goto('/app/parent/profile')

  await expect(page.getByRole('heading', { name: 'Parent profile' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible()
  await expect(page.getByLabel('Email address')).toHaveValue('parent@example.com')
  await expect(page.locator('aside')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

async function prepareParentSession(
  page: Page,
  theme: 'day' | 'night',
  children: typeof linkedChildren,
  language: 'uk' | 'en' = 'uk',
) {
  await page.addInitScript(({ selectedTheme, selectedLanguage }) => {
    localStorage.setItem('obriy-night-default-v1', 'done')
    localStorage.setItem('obriy-theme', selectedTheme)
    localStorage.setItem('obriy-language', selectedLanguage)
    localStorage.setItem('obriy-has-session', '1')
  }, { selectedTheme: theme, selectedLanguage: language })

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'parent-visual-access-token',
        user: {
          id: 'parent-visual',
          email: 'parent@example.com',
          role: 'PARENT',
          status: 'ACTIVE',
          emailVerifiedAt: '2026-07-18T12:00:00.000Z',
          hasPassword: true,
          profile: {
            displayName: 'Олена Коваль',
            avatarUrl: null,
            bio: null,
            subjectArea: null,
            preferredLocale: language === 'en' ? 'EN' : 'UK',
          },
        },
      }),
    })
  })

  await page.route('**/users/me/children', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(children),
    })
  })
  const summaries = children.map((child) => ({
    ...child,
    class: { id: 'class-1', name: 'Історія' },
    metrics: {
      requiredReleaseCount: 4,
      completedCount: 2,
      completionPercent: 50,
      averagePercent: 72,
      attentionCount: child.id === 'child-maria' ? 1 : 0,
      nextDueAt: '2026-09-12T12:00:00.000Z',
    },
  }))
  await page.route('**/parent/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ children: summaries }),
    }),
  )
  await page.route('**/parent/children/child-maria/overview', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        child: summaries[0],
        attention: [visualWork('Карта держав', 'DUE_SOON')],
        upcoming: [visualWork('Писемні джерела', null)],
        recentActivity: [visualWork('Хронологія', null, 'COMPLETED')],
      }),
    }),
  )
  await page.route('**/notifications/unread-count', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"unreadCount":0}' }),
  )
}

function visualWork(title: string, attentionReason: string | null, status = 'NOT_STARTED') {
  return {
    releaseId: title, testId: title, title,
    lesson: { id: 'lesson-1', title: 'Ранні держави', position: 1 },
    releaseStatus: 'ACTIVE', isRequired: true, availability: 'AVAILABLE', status,
    availableFrom: null, dueAt: '2026-09-12T12:00:00.000Z', maxPoints: 10,
    scorePoints: null, scorePercent: null, bestPoints: null, bestPercent: null,
    attemptCount: 0, lastActivityAt: '2026-09-11T12:00:00.000Z', attentionReason,
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
}
