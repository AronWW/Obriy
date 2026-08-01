import { expect, test, type Page } from '@playwright/test'

const linkedChildren = [
  {
    id: 'child-maria',
    displayName: 'Марія Коваль',
    avatarUrl: null,
    gradeLevel: 7,
  },
  {
    id: 'child-ostap',
    displayName: 'Остап Коваль',
    avatarUrl: null,
    gradeLevel: 4,
  },
  {
    id: 'child-solomia',
    displayName: 'Соломія Коваль',
    avatarUrl: null,
    gradeLevel: null,
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

  await page.goto('/app/parent')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await expect(
    page.getByRole('heading', { name: 'Марія Коваль' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Варто перевірити' }),
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

async function prepareParentSession(
  page: Page,
  theme: 'day' | 'night',
  children: typeof linkedChildren,
) {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('obriy-theme', selectedTheme)
    localStorage.setItem('obriy-language', 'uk')
    localStorage.setItem('obriy-has-session', '1')
  }, theme)

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
          profile: {
            displayName: 'Олена Коваль',
            avatarUrl: null,
            bio: null,
            gradeLevel: null,
            subjectArea: null,
            preferredLocale: 'UK',
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
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
}
